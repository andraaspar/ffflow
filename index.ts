export interface IFfflowStep<T extends object> {
	(e: any, flow: IFfflowGuts<T>): void
}
export interface IFfflowGutsBase<T extends object> {
	data: T
	isAborted: () => boolean
}
export interface IFfflowGuts<T extends object> extends IFfflowGutsBase<T> {
	getParallelErrors: () => any[] | undefined
	resolve: () => void
	reject: (e?: any) => void
	abort: (e?: any) => void
}
interface IFfflowGutsPrivate<T extends object> extends IFfflowGutsBase<T> {
	state: FfflowState
	error: any
	isParallelErrorNew: boolean
	resolve: (subStep: IFfflowStep<T> | undefined) => void
	reject: (subStep: IFfflowStep<T>, e?: any) => void
	abort: (subStep: IFfflowStep<T>, e?: any) => void
}
export type TStep<T extends object> = IFfflowStep<T> | (IFfflowStep<T> | undefined)[] | undefined
export type TSteps<T extends object> = TStep<T>[]

export enum FfflowState {
	Stopped,
	Working,
	Aborted,
	Done,
}

export interface IFfflowTapper {
	resolve: () => any
	reject: (e?: any) => any
	abort: (e?: any) => any
}

export class Ffflow<T extends object = object> {
	private name?: string
	private stepIndex: number
	private guts: IFfflowGutsPrivate<T>
	private steps: TSteps<T>
	private step: TStep<T>
	private tappers: IFfflowTapper[] = []

	constructor(o: { steps: TSteps<T>, name?: string }) {
		this.name = o.name
		this.steps = o.steps
		// this.log('construct')
		this.newGuts()
	}
	start() {
		// this.log('start')
		this.abort('[owxs4w] start')
		this.next()
		return this
	}
	abort(e?: any) {
		// this.log('abort')
		if (this.getState() === FfflowState.Working) {
			this.setState(FfflowState.Aborted)
			this.guts.error = e
			this.onDone()
		}
		if (this.getState() !== FfflowState.Stopped) this.newGuts()
		return this
	}
	private newGuts() {
		// this.log('newGuts')
		this.stepIndex = -1
		let guts: IFfflowGutsPrivate<T> = {
			data: {} as T,
			error: undefined,
			isParallelErrorNew: false,
			resolve: (subStep) => {
				// this.log('guts.resolve')
				if (this.isCurrentGutsAndSubStep(guts, subStep)) {
					// this.log('-- valid')
					// this.log(JSON.stringify(guts, undefined, 2), JSON.stringify(this.guts, undefined, 2))
					this.onStepDone(guts, subStep, undefined)
				}
			},
			reject: (subStep, e) => {
				// this.log('guts.reject')
				if (this.isCurrentGutsAndSubStep(guts, subStep)) {
					// this.log('-- valid')
					this.onStepDone(guts, subStep, e || new Error())
				}
			},
			abort: (subStep, e) => {
				// this.log('guts.abort')
				if (this.isCurrentGutsAndSubStep(guts, subStep)) {
					// this.log('-- valid')
					this.abort(e)
					this.onStepDone(guts, subStep, undefined)
				}
			},
			isAborted: () => {
				// this.log('guts.isAborted', FfflowState[guts.state])
				return guts.state === FfflowState.Aborted
			},
			state: FfflowState.Stopped,
		}
		this.guts = guts
	}
	private next() {
		// this.log('next')
		this.stepIndex++
		this.guts.isParallelErrorNew = false
		if (this.stepIndex < this.steps.length) {
			let step = this.steps[this.stepIndex]
			if (Array.isArray(step)) {
				if (step.length) {
					this.step = step.slice()
					let guts = this.guts
					for (let subStep of step) {
						if (this.guts !== guts) break
						this.doStep(subStep)
					}
				} else {
					this.next()
				}
			} else {
				this.step = step
				this.doStep(step)
			}
		} else {
			this.setState(FfflowState.Done)
			this.onDone()
		}
	}
	private onDone() {
		// this.log('onDone')
		for (let tapper of this.tappers) {
			try {
				if (this.isAborted()) {
					tapper.abort(this.getError())
				} else {
					if (this.getError()) {
						tapper.reject(this.getError())
					} else {
						tapper.resolve()
					}
				}
			} catch (e) {
				console.error(e)
			}
		}
	}
	private doStep(step: IFfflowStep<T> | undefined) {
		// this.log('doStep')
		if (this.getState() === FfflowState.Stopped) {
			this.setState(FfflowState.Working)
		}
		let guts = this.guts
		if (step) {
			try {
				step(guts.error, {
					data: guts.data,
					resolve: () => guts.resolve(step),
					reject: (e) => guts.reject(step, e),
					abort: (e) => guts.abort(step, e),
					isAborted: () => guts.isAborted(),
					getParallelErrors: () => guts.isParallelErrorNew ? guts.error : undefined,
				})
			} catch (e) {
				guts.reject(step, e)
			}
		} else {
			guts.resolve(step)
		}
	}
	private isCurrentGutsAndSubStep(guts: IFfflowGutsPrivate<T>, subStep: IFfflowStep<T> | undefined) {
		let result = false
		if (this.guts === guts) {
			// this.log('isCurrentGutsAndSubStep -> guts equal')
			if (Array.isArray(this.step)) {
				result = this.step.indexOf(subStep) >= 0
				// this.log('isCurrentGutsAndSubStep -> array:', result)
			} else {
				result = subStep === this.step
				// this.log('isCurrentGutsAndSubStep -> single:', result)
			}
		}
		return result
	}
	private onStepDone(guts: IFfflowGutsPrivate<T>, subStep: IFfflowStep<T> | undefined, stepError: any) {
		// this.log('onStepDone')
		if (this.isCurrentGutsAndSubStep(guts, subStep)) {
			if (Array.isArray(this.step)) {
				if (stepError) {
					if (!this.guts.isParallelErrorNew) {
						this.guts.isParallelErrorNew = true
						this.guts.error = []
					}
					this.guts.error.push(stepError)
				}
				for (let i = this.step.length - 1; i >= 0; i--) {
					if (this.step[i] === subStep) {
						this.step.splice(i, 1)
					}
				}
			} else {
				this.guts.error = stepError
			}
			if (!Array.isArray(this.step)) {
				this.next()
			} else if (this.step.length == 0) {
				// Parallel end
				if (!this.guts.isParallelErrorNew) {
					// No new errors
					this.guts.error = undefined
				}
				this.next()
			}
		}
	}
	getState() {
		return this.guts ? this.guts.state : FfflowState.Stopped
	}
	private setState(state: FfflowState) {
		this.guts.state = state
	}
	isWorking() {
		return this.getState() === FfflowState.Working
	}
	isAborted() {
		return this.getState() === FfflowState.Aborted
	}
	isStopped() {
		return this.getState() === FfflowState.Stopped
	}
	isDone() {
		return this.getState() === FfflowState.Done
	}
	getData(): T {
		return this.guts ? this.guts.data : {} as T
	}
	getError(): any {
		return this.guts ? this.guts.error : undefined
	}
	tap(tapper: IFfflowTapper) {
		this.untap(tapper)
		this.tappers.push(tapper)
		if (this.isDone()) {
			if (this.getError()) {
				tapper.reject(this.getError())
			} else {
				tapper.resolve()
			}
		} else if (this.isAborted()) {
			throw new Error(`[owxut2] never`)
		}
		return this
	}
	untap(tapper: IFfflowTapper) {
		for (let i = this.tappers.length - 1; i >= 0; i--) {
			if (this.tappers[i] === tapper) {
				this.tappers.splice(i, 1)
				break
			}
		}
	}
	// private log(...rest: any[]) {
	// 	if (this.name) {
	// 		console.log(this.name + ':', ...rest)
	// 	}
	// }
}