import { Ffflow } from './index'

describe('Ffflow', () => {
	describe('normal use', () => {
		it('is stopped by default', () => {
			let f = new Ffflow({ steps: [] })
			expect(f.isStopped()).toBe(true)
		})
		it('starts when started', () => {
			let f = new Ffflow({
				steps: [
					(e, flow) => { }
				]
			})
			f.start()
			expect(f.isWorking()).toBe(true)
		})
		it('is done when all steps are resolved', () => {
			let f = new Ffflow({ steps: [] })
			f.start()
			expect(f.isDone()).toBe(true)
		})
		it('has no data by default', () => {
			let f = new Ffflow({ steps: [] })
			expect(f.getData()).toEqual({})
		})
		it('executes a step', (done) => {
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						done()
					}
				]
			})
			f.start()
		})
		it('tolerates undefined', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					undefined,
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).toHaveBeenCalledTimes(1)
		})
		it('executes multiple steps', (done) => {
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						flow.resolve()
					},
					(e, flow) => {
						done()
					},
				]
			})
			f.start()
		})
		it('catches errors', (done) => {
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						throw 'error'
					},
					(e, flow) => {
						expect(e).toBe('error')
						done()
					},
				]
			})
			f.start()
		})
		it('catches rejects', (done) => {
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						flow.reject('error')
					},
					(e, flow) => {
						expect(e).toBe('error')
						done()
					},
				]
			})
			f.start()
		})
		it('executes multiple steps asynchronously', (done) => {
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						setTimeout(flow.resolve)
					},
					(e, flow) => {
						done()
					},
				]
			})
			f.start()
			expect(f.isWorking()).toBe(true)
		})
		it('shares flow.data between steps', (done) => {
			let f = new Ffflow<{ value?: number }>({
				steps: [
					(e, flow) => {
						flow.data.value = 42
						flow.resolve()
					},
					(e, flow) => {
						expect(flow.data.value).toBe(42)
						done()
					},
				]
			})
			f.start()
		})
		it('can be aborted', (done) => {
			let doneStep = jasmine.createSpy('doneStep')
			let f = new Ffflow({
				steps: [
					(e, flow) => setTimeout(flow.resolve),
					doneStep,
				]
			})
			f.start()
			f.abort()
			setTimeout(() => {
				expect(doneStep).not.toHaveBeenCalled()
				done()
			}, 10)
		})
		it('data is lost on abort', () => {
			let f = new Ffflow<{ value?: number }>({
				steps: [
					(e, flow) => {
						flow.data.value = 42
					},
				]
			})
			f.start()
			expect(f.getData().value).toBe(42)
			f.abort()
			expect(f.getData().value).toBeUndefined()
		})
		it('propagates aborted state to running step', (done) => {
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						expect(flow.isAborted()).toBe(false)
						setTimeout(() => {
							expect(flow.isAborted()).toBe(true)
							done()
						})
					},
				]
			})
			f.start()
			f.abort()
		})
		it('aborts when restarted', (done) => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					(e, flow) => setTimeout(flow.resolve),
					doneFunc,
				]
			})
			f.start()
			f.start()
			setTimeout(() => {
				expect(doneFunc).toHaveBeenCalledTimes(1)
				done()
			}, 10)
		})
		it('can be resolved only once', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						flow.resolve()
						flow.resolve()
					},
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).toHaveBeenCalledTimes(1)
		})
		it('can not be resolved after rejected', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						flow.reject()
						flow.resolve()
					},
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).toHaveBeenCalledTimes(1)
		})
		it('can not be rejected after resolved', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						flow.resolve()
						flow.reject()
					},
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).toHaveBeenCalledTimes(1)
		})
		it('can not be resolved after aborted', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						flow.abort()
						flow.resolve()
					},
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).not.toHaveBeenCalled()
		})
		it('can not be rejected after aborted', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						flow.abort()
						flow.reject()
					},
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).not.toHaveBeenCalled()
		})
		it('can not be resolved after throw', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						setTimeout(() => flow.resolve)
						throw 'error'
					},
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).toHaveBeenCalledTimes(1)
		})
		it('can not be rejected after throw', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						setTimeout(() => flow.reject)
						throw 'error'
					},
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).toHaveBeenCalledTimes(1)
		})
	})
	describe('parallel use', () => {
		it('can execute steps in parallel', () => {
			let fun1 = jasmine.createSpy('fun1')
			let fun2 = jasmine.createSpy('fun2')
			let f = new Ffflow({
				steps: [
					[fun1, fun2],
				]
			})
			f.start()
			expect(fun1).toHaveBeenCalledTimes(1)
			expect(fun2).toHaveBeenCalledTimes(1)
		})
		it('waits for all parallel steps to resolve', (done) => {
			let f = new Ffflow<{ a?: boolean, b?: boolean }>({
				steps: [
					[
						(e, flow) => setTimeout(() => {
							flow.data.a = true
							flow.resolve()
						}, 10),
						(e, flow) => setTimeout(() => {
							flow.data.b = true
							flow.resolve()
						}, 5),
					],
					(e, flow) => {
						expect(flow.data).toEqual({ a: true, b: true })
						done()
					},
				]
			})
			f.start()
		})
		it('cannot resolve after abort', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					[
						(e, flow) => flow.resolve(),
						(e, flow) => {
							flow.abort()
							flow.resolve()
						},
					],
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).not.toHaveBeenCalled()
		})
		it('cannot resolve after resolve', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					[
						(e, flow) => {
							flow.resolve()
							setTimeout(flow.resolve)
						},
						(e, flow) => {
							flow.resolve()
							setTimeout(flow.resolve)
						},
					],
					doneFunc,
				]
			})
			f.start()
			setTimeout(() => {
				expect(doneFunc).toHaveBeenCalledTimes(1)
			}, 10)
		})
		it('cannot abort after resolve', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow<{ value?: number }>({
				steps: [
					[
						(e, flow) => {
							flow.data.value = 42
							flow.resolve()
						},
						(e, flow) => {
							flow.resolve()
							flow.abort()
						},
					],
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).toHaveBeenCalledTimes(1)
			expect(f.getData()).toEqual({ value: 42 })
		})
		it('tolerates empty array', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					[],
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).toHaveBeenCalledTimes(1)
		})
		it('tolerates undefined', () => {
			let doneFunc = jasmine.createSpy('doneFunc')
			let f = new Ffflow({
				steps: [
					[undefined],
					doneFunc,
				]
			})
			f.start()
			expect(doneFunc).toHaveBeenCalledTimes(1)
		})
		it('handles errors', (done) => {
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						throw 'error'
					},
					[
						(e, flow) => {
							flow.resolve()
						},
						(e, flow) => {
							flow.resolve()
						},
					],
					(e, flow) => {
						expect(e).toBe(undefined)
						done()
					},
				]
			})
			f.start()
		})
		it('handles previous multi errors', (done) => {
			let f = new Ffflow({
				steps: [
					[
						(e, flow) => {
							flow.reject()
						},
						(e, flow) => {
							flow.reject()
						},
					],
					[
						(e, flow) => {
							flow.resolve()
						},
						(e, flow) => {
							flow.resolve()
						},
					],
					(e, flow) => {
						expect(e).toBe(undefined)
						done()
					},
				]
			})
			f.start()
		})
		it('keeps the error from any branch', (done) => {
			let f = new Ffflow({
				steps: [
					[
						(e, flow) => {
							flow.reject('error')
						},
						(e, flow) => {
							flow.resolve()
						},
					],
					(e, flow) => {
						expect(e).toEqual(['error'])
						done()
					},
				]
			})
			f.start()
		})
		it('keeps all errors', (done) => {
			let f = new Ffflow({
				steps: [
					[
						(e, flow) => {
							setTimeout(() => flow.reject('a'))
						},
						(e, flow) => {
							setTimeout(() => flow.reject('b'), 10)
						},
					],
					(e, flow) => {
						expect(e).toEqual(['a', 'b'])
						done()
					},
				]
			})
			f.start()
		})
		it('propagates first abort reason', (done) => {
			let resolve = jasmine.createSpy('resolve')
			let reject = jasmine.createSpy('reject')
			let f = new Ffflow({
				steps: [
					[
						(e, flow) => {
							setTimeout(() => flow.abort('a'))
						},
						(e, flow) => {
							setTimeout(() => flow.abort('b'), 10)
						},
					],
				]
			})
			f.tap({
				resolve,
				reject,
				abort: (e) => {
					expect(resolve).not.toHaveBeenCalled()
					expect(reject).not.toHaveBeenCalled()
					expect(e).toBe('a')
					done()
				},
			})
			f.start()
		})
		it('propagates parallel errors', (done) => {
			let f = new Ffflow({
				steps: [
					[
						(e, flow) => {
							setTimeout(() => {
								expect(flow.getParallelErrors()).toBeUndefined()
								flow.reject('a')
							})
						},
						(e, flow) => {
							setTimeout(() => {
								expect(flow.getParallelErrors()).toEqual(['a'])
								flow.reject('b')
							}, 10)
						},
						(e, flow) => {
							setTimeout(() => {
								expect(flow.getParallelErrors()).toEqual(['a', 'b'])
								done()
							}, 20)
						},
					],
				]
			})
			f.start()
		})
		it('propagates does not include old errors in parallel errors', (done) => {
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						throw 'error'
					},
					[
						(e, flow) => {
							setTimeout(() => {
								expect(flow.getParallelErrors()).toBeUndefined()
								done()
							})
						}
					],
				]
			})
			f.start()
		})
		it('handles abort', (done) => {
			let abort = jasmine.createSpy('abort')
			let resolve = jasmine.createSpy('resolve')
			let reject = jasmine.createSpy('reject')
			let f = new Ffflow({
				steps: [
					[
						(e, flow) => flow.abort('a'),
						(e, flow) => flow.abort('b'),
					],
				]
			})
			f.tap({
				resolve,
				reject,
				abort: (e) => {
					expect(e).toBe('a')
					done()
				},
			})
			f.start()
		})
	})
	describe('.tap()', () => {
		it('is resolved immediately if done', () => {
			let abort = jasmine.createSpy('abort')
			let resolve = jasmine.createSpy('resolve')
			let reject = jasmine.createSpy('reject')
			let f = new Ffflow({ steps: [] })
			f.start()
			f.tap({ resolve, reject, abort })
			expect(resolve).toHaveBeenCalledTimes(1)
			expect(reject).not.toHaveBeenCalled()
			expect(abort).not.toHaveBeenCalled()
		})
		it('is rejected immediately if done', () => {
			let abort = jasmine.createSpy('abort')
			let resolve = jasmine.createSpy('resolve')
			let reject = jasmine.createSpy('reject')
			let f = new Ffflow({ steps: [
				(e, flow) => flow.reject(),
			] })
			f.start()
			f.tap({ resolve, reject, abort })
			expect(resolve).not.toHaveBeenCalled()
			expect(reject).toHaveBeenCalledTimes(1)
			expect(abort).not.toHaveBeenCalled()
		})
		it('waits for tapped', () => {
			let abort = jasmine.createSpy('abort')
			let resolve = jasmine.createSpy('resolve')
			let reject = jasmine.createSpy('reject')
			let f = new Ffflow({ steps: [] })
			f.tap({ resolve, reject, abort })
			expect(resolve).not.toHaveBeenCalled()
			expect(reject).not.toHaveBeenCalled()
			expect(abort).not.toHaveBeenCalled()
		})
		it('works multiple times', () => {
			let abort = jasmine.createSpy('abort')
			let resolve = jasmine.createSpy('resolve')
			let reject = jasmine.createSpy('reject')
			let f = new Ffflow({ steps: [] })
			f.tap({ resolve, reject, abort })
			f.start()
			f.start()
			expect(resolve).toHaveBeenCalledTimes(2)
			expect(reject).not.toHaveBeenCalled()
			expect(abort).not.toHaveBeenCalled()
		})
		it('propagates abort', () => {
			let abort = jasmine.createSpy('abort')
			let resolve = jasmine.createSpy('resolve')
			let reject = jasmine.createSpy('reject')
			let f = new Ffflow({
				steps: [
					(e, flow) => {
						flow.abort()
					},
				]
			})
			f.tap({ resolve, reject, abort })
			f.start()
			expect(resolve).not.toHaveBeenCalled()
			expect(reject).not.toHaveBeenCalled()
			expect(abort).toHaveBeenCalledTimes(1)
		})
		it('can be untapped', () => {
			let abort = jasmine.createSpy('abort')
			let resolve = jasmine.createSpy('resolve')
			let reject = jasmine.createSpy('reject')
			let tapper = { resolve, reject, abort }
			let f = new Ffflow({ steps: [] })
			f.tap(tapper)
			f.untap(tapper)
			f.start()
			expect(resolve).not.toHaveBeenCalled()
			expect(reject).not.toHaveBeenCalled()
			expect(abort).not.toHaveBeenCalled()
		})
		it('adds a tapper only once', () => {
			let abort = jasmine.createSpy('abort')
			let resolve = jasmine.createSpy('resolve')
			let reject = jasmine.createSpy('reject')
			let tapper = { resolve, reject, abort }
			let f = new Ffflow({ steps: [] })
			f.tap(tapper)
			f.tap(tapper)
			f.start()
			expect(resolve).toHaveBeenCalledTimes(1)
			expect(reject).not.toHaveBeenCalled()
			expect(abort).not.toHaveBeenCalled()
		})
		it('propagates reject reason', (done) => {
			let abort = jasmine.createSpy('abort')
			let resolve = jasmine.createSpy('resolve')
			let f = new Ffflow({ steps: [
				(e, flow) => {
					flow.reject('error')
				}
			] })
			f.tap({
				abort,
				resolve,
				reject: (e) => {
					expect(e).toBe('error')
					expect(resolve).not.toHaveBeenCalled()
					expect(abort).not.toHaveBeenCalled()
					done()
				},
			})
			f.start()
		})
		it('propagates error thrown', (done) => {
			let abort = jasmine.createSpy('abort')
			let resolve = jasmine.createSpy('resolve')
			let f = new Ffflow({ steps: [
				(e, flow) => {
					throw 'error'
				}
			] })
			f.tap({
				abort,
				resolve,
				reject: (e) => {
					expect(e).toBe('error')
					expect(resolve).not.toHaveBeenCalled()
					expect(abort).not.toHaveBeenCalled()
					done()
				},
			})
			f.start()
		})
	})
})