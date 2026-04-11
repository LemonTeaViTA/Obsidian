# ThreadPoolExceptionHandling

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadPoolExecutor](ThreadPoolExecutor.md)

## 核心结论

线程池异常处理常见有四种方式：try-catch、Future、afterExecute、UncaughtExceptionHandler。

## 入口

- try-catch
- Future.get()
- afterExecute()
- UncaughtExceptionHandler
- execute / submit

## 处理方式

- execute() 提交的任务，异常通常交给线程的 UncaughtExceptionHandler。
- submit() 提交的任务，异常会封装在 Future 里，通过 get() 获取。
- 全局捕获可以重写 afterExecute()。

常见做法可以分成四类：

- try-catch：任务内部自己兜底，适合单点处理。
- Future.get()：配合 submit() 获取执行异常。
- afterExecute()：继承 ThreadPoolExecutor 做全局拦截。
- UncaughtExceptionHandler：更适合 execute() 场景。

如果项目使用 execute() 且不关心返回值，优先考虑 UncaughtExceptionHandler；如果使用 submit() 且关心结果，优先通过 Future.get() 处理异常。

如果希望统一捕获线程池里所有任务异常，可以重写 afterExecute()，在其中对 Future 结果做二次检查。

## 适用建议

不关心返回值时更适合 execute() + UncaughtExceptionHandler；关心返回值时更适合 submit() + Future。

## 关联页

- [ThreadPoolExecutor](ThreadPoolExecutor.md)
