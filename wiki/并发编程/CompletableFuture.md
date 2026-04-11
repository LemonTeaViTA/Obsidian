# CompletableFuture

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [Exchanger](Exchanger.md)

## 核心结论

CompletableFuture 是 Java 8 引入的异步编程工具，可以在任务完成后继续串联后续动作。

## 入口

- supplyAsync()
- thenAccept()
- 异步编程
- 结果传递
- 链式调用

## 基本用法

CompletableFuture 常用于把一个异步任务的结果传给下一个处理步骤。

```java
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
	return "Message from CompletableFuture";
});

future.thenAccept(message -> {
	System.out.println("Received: " + message);
});
```

它的典型链路是：supplyAsync 异步生产结果，thenAccept/thenApply 在结果完成后继续处理，实现非阻塞的任务编排。

```java
CompletableFuture.supplyAsync(() -> "业务结果")
	.thenAccept(result -> System.out.println("处理结果: " + result));
```

## 使用场景

适合异步请求、任务编排、并行计算后汇总结果这类场景。

## 关联页

- [Exchanger](Exchanger.md)
