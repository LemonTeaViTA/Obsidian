### 讲讲 HashSet 的底层实现？ 
 HashSet 是由 [[HashMap核心原理|HashMap]] 实现的，只不过值由一个固定的 Object 对象填充，而键用于操作。 
```java
 public class HashSet < E > 
 extends AbstractSet < E > 
 implements Set < E >, Cloneable , java . io . Serializable 
 { 
 static final long serialVersionUID = - 5024744406713321676L ; 
 private transient HashMap < E , Object > map ; 
 // Dummy value to associate with an Object in the backing Map 
 private static final Object PRESENT = new Object (); 
 // …… 
 } 
```
 实际开发中，HashSet 并不常用，比如，如果我们需要按照顺序存储一组元素，那么 ArrayList 和 LinkedList 更适合；如果我们需要存储键值对并根据键进行查找，那么 HashMap 可能更适合。 
 HashSet 主要用于去重，比如，我们需要统计一篇文章中有多少个不重复的单词，就可以使用 HashSet 来实现。 
```java
 // 创建一个 HashSet 对象 
 HashSet < String > set = new HashSet <>(); 
 
 // 添加元素 
 set . add ( "沉默" ); 
 set . add ( "王二" ); 
 set . add ( "陈清扬" ); 
 set . add ( "沉默" ); 
 
 // 输出 HashSet 的元素个数 
 System . out . println ( "HashSet size: " + set . size ()); // output: 3 
 
 // 遍历 HashSet 
 for ( String s : set ) { 
 System . out . println ( s ); 
 } 
```
 HashSet 会自动去重，因为它是用 HashMap 实现的，HashMap 的键是唯一的，相同键会覆盖掉原来的键，于是第二次 `add` 一个相同键的元素会直接覆盖掉第一次的键。 
 
 
 **HashSet 和 ArrayList 的区别** 
 
*   **ArrayList** 是基于动态数组实现的，**HashSet** 是基于 HashMap 实现的。 
*   **ArrayList** 允许重复元素和 `null` 值，可以有多个相同的元素；**HashSet** 保证每个元素唯一，不允许重复元素，基于元素的 `hashCode` 和 `equals` 方法来确定元素的唯一性。 
*   **ArrayList** 保持元素的插入顺序，可以通过索引访问元素；**HashSet** 不保证元素的顺序，元素的存储顺序依赖于哈希算法，并且可能随着元素的添加或删除而改变。 
 
 
 
 **HashSet 怎么判断元素重复，重复了是否 put** 
 HashSet 的 `add` 方法是通过调用 HashMap 的 `put` 方法实现的： 
```java
 public boolean add ( E e ) { 
 return map . put ( e , PRESENT )== null ; 
 } 
```
 所以 HashSet 判断元素重复的逻辑底层依然是 HashMap 的底层逻辑： 
 
 HashMap 在插入元素时，通常需要三步： 
 第一步，通过 `hash` 方法计算 key 的哈希值。 
```java
 static final int hash ( Object key ) { 
 int h ; 
 return ( key == null ) ? 0 : ( h = key . hashCode ()) ^ ( h >>> 16 ); 
 } 
```
 第二步，数组进行第一次扩容。 
```java
 if (( tab = table ) == null || ( n = tab . length ) == 0 ) 
 n = ( tab = resize ()). length ; 
```
 第三步，根据哈希值计算 key 在数组中的下标，如果对应下标正好没有存放数据，则直接插入。 
```java
 if (( p = tab [ i = ( n - 1 ) & hash ]) == null ) 
 tab [ i ] = newNode ( hash , key , value , null ); 
```
 如果对应下标已经有数据了，就需要判断是否为相同的 key，是则覆盖 value，否则需要判断是否为树节点，是则向树中插入节点，否则向链表中插入数据。 
```java
 else { 
 Node < K , V > e ; K k ; 
 if ( p . hash == hash && 
 (( k = p . key ) == key || ( key != null && key . equals ( k )))) 
 e = p ; 
 else if ( p instanceof TreeNode ) 
 e = (( TreeNode < K , V >) p ). putTreeVal ( this , tab , hash , key , value ); 
 else { 
 for ( int binCount = 0 ; ; ++ binCount ) { 
 if (( e = p . next ) == null ) { 
 p . next = newNode ( hash , key , value , null ); 
 if ( binCount >= TREEIFY_THRESHOLD - 1 ) // -1 for 1st 
 treeifyBin ( tab , hash ); 
 break ; 
 } 
 if ( e . hash == hash && 
 (( k = e . key ) == key || ( key != null && key . equals ( k )))) 
 break ; 
 p = e ; 
 } 
 } 
 } 
```
 也就是说，HashSet 通过元素的哈希值来判断元素是否重复，如果重复了，会覆盖原来的值。 
```java
 if ( e != null ) { // existing mapping for key 
 V oldValue = e . value ; 
 if (! onlyIfAbsent || oldValue == null ) 
 e . value = value ; 
 afterNodeAccess ( e ); 
 return oldValue ; 
 } 
```
 
 
 
 

