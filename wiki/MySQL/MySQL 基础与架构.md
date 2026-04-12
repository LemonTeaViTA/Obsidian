> 来源文件：raw/files/面渣逆袭MySQL篇 V2.0.epub
> 正文位置：EPUB/text/ch001.xhtml
> 导航位置：EPUB/nav.xhtml
> 导入方式：自动抽取（待你后续精修）### 两张表怎么进行连接？ 
 可以通过内连接 inner join 、外连接 outer join 、交叉连接 cross join 来合并多个表的查询结果。 
 
 什么是内连接？ 
 内连接用于返回两个表中有匹配关系的行。假设有两张表，用户表和订单表，想查询有订单的用户，就可以使用内连接 users INNER JOIN orders ，按照用户 ID 关联就行了。 
 SELECT users.name, orders.order_id 
 FROM users 
 INNER JOIN orders ON users. id = orders.user_id; 
 只有那些在两个表中都存在 user_id 的记录才会出现在查询结果中。 
 
 
 什么是外连接？ 
 和内连接不同，外连接不仅返回两个表中匹配的行，还返回没有匹配的行，用 null 来填充。 
 外连接又分为左外连接 left join 和右外连接 right join 。 
 left join 会保留左表中符合条件的所有记录，如果右表中有匹配的记录，就返回匹配的记录，否则就用 null 填充，常用于某表中有，但另外一张表中可能没有的数据的查询场景。 
 假设要查询所有用户及他们的订单，即使用户没有下单，就可以使用左连接： 
 SELECT users. id , users.name, orders.order_id 
 FROM users 
 LEFT JOIN orders ON users. id = orders.user_id; 
 查询前： 
 
 
 
 users 
 orders 
 
 
 
 
 id 
 name 
 
 
 1 
 王二 
 
 
 2 
 张三 
 
 
 3 
 李四 
 
 
 
 查询后： 
 
 
 
 id 
 name 
 order_id 
 
 
 
 
 1 
 王二 
 10 
 
 
 2 
 张三 
 20 
 
 
 3 
 李四 
 null 
 
 
 
 右连接就是左连接的镜像，right join 会保留右表中符合条件的所有记录，如果左表中有匹配的记录，就返回匹配的记录，否则就用 null 填充。 
 
 
 什么是交叉连接？ 
 交叉连接会返回两张表的笛卡尔积，也就是将左表的每一行与右表的每一行进行组合，返回的行数是两张表行数的乘积。 
 假设有 A 表和 B 表，A 表有 2 行数据，B 表有 3 行数据，那么交叉连接的结果就是 2 ✖️ 3 = 6 行。 
 SELECT A. id , B. id 
 FROM A 
 CROSS JOIN B; 
 笛卡尔积是数学中的一个概念，例如集合 A={a,b} ，集合 B={0,1,2} ，那么 A✖️B= {<a,0>,<a,1>,<a,2>,<b,0>,<b,1>,<b,2>,} 。 ### 内连接、左连接、右连接有什么区别？ 
 MySQL 的连接主要分为内连接和外连接，外连接又可以分为左连接和右连接。 
 
 内连接可以用来找出两个表中共同的记录，相当于两个数据集的交集。 
 左连接和右连接可以用来找出两个表中不同的记录，相当于两个数据集的并集。两者的区别是，左连接会保留左表中符合条件的所有记录，右连接则刚好相反。 
 拿 技术派实战项目 的表为例来详细验证下。 
 有三张表，一张文章表 article，主要存文章标题 title， 一张文章详情表 article_detail，主要存文章的内容 content，一张文章评论表 comment，主要存评论 content，三个表通过文章 id 关联。 
 先来看内连接： 
 SELECT LEFT (a.title, 20 ) AS ArticleTitle, LEFT (c.content, 20 ) AS CommentContent 
 FROM article a 
 INNER JOIN comment c ON a. id = c.article_id 
 LIMIT 2 ; 
 
 返回至少有一条评论的文章标题和评论内容（前 20 个字符），只返回符合条件的前 2 条记录。 
 再来看做连接： 
 SELECT LEFT (a.title, 20 ) AS ArticleTitle, LEFT (c.content, 20 ) AS CommentContent 
 FROM article a 
 LEFT JOIN comment c ON a. id = c.article_id 
 LIMIT 2 ; 
 
 返回所有文章的标题和文章评论，即使某些文章没有评论（填充为 NULL）。 
 最后来看右连： 
 SELECT LEFT (a.title, 20 ) AS ArticleTitle, LEFT (c.content, 20 ) AS CommentContent 
 FROM comment c 
 RIGHT JOIN article a ON a. id = c.article_id 
 LIMIT 2 ; ### 说一下数据库的三大范式？ 
 
 第一范式，确保表的每一列都是不可分割的基本数据单元，比如说用户地址，应该拆分成省、市、区、详细地址等 4 个字段。 
 
 第二范式，要求表中的每一列都和主键直接相关。比如在订单表中，商品名称、单位、商品价格等字段应该拆分到商品表中。 
 
 然后新建一个订单商品关联表，用订单编号和商品编号进行关联就好了。 
 
 第三范式，非主键列应该只依赖于主键列。比如说在设计订单信息表的时候，可以把客户名称、所属公司、联系方式等信息拆分到客户信息表中，然后在订单信息表中用客户编号进行关联。 
 
 
 建表的时候需要考虑哪些问题？ 
 首先需要考虑表是否符合数据库的三大范式，确保字段不可再分，消除非主键依赖，确保字段仅依赖于主键等。 
 然后在选择字段类型时，应该尽量选择合适的数据类型。 
 在字符集上，尽量选择 utf8mb4，这样不仅可以支持中文和英文，还可以支持表情符号等。 
 当数据量较大时，比如上千万行数据，需要考虑分表。比如订单表，可以采用水平分表的方式来分散单表存储压力。 ### varchar 与 char 的区别？ 
 varchar 是可变长度的字符类型，原则上最多可以容纳 65535 个字符，但考虑字符集，以及 MySQL 需要 1 到 2 个字节来表示字符串长度，所以实际上最大可以设置到 65533。 
 
 latin1 字符集，且列属性定义为 NOT NULL。 
 
 
 char 是固定长度的字符类型，当定义一个 CHAR(10) 字段时，不管实际存储的字符长度是多少，都只会占用 10 个字符的空间。如果插入的数据小于 10 个字符，剩余的部分会用空格填充。 
 
 
 
 值 
 CHAR(4) 
 存储需求（字节） 
 VARCHAR(4) 
 存储需求（字节） 
 
 
 
 
 '' 
 ' ' 
 4 
 '' 
 1 
 
 
 'ab' 
 'ab ' 
 4 
 'ab' 
 3 
 
 
 'abcd' 
 'abcd' 
 4 
 'abcd' 
 5 
 
 
 'abcdefgh' 
 'abcd' 
 4 
 'abcd' 
 5 ### blob 和 text 有什么区别？ 
 blob 用于存储二进制数据，比如图片、音频、视频、文件等；但实际开发中，我们都会把这些文件存储到 OSS 或者文件服务器上，然后在数据库中存储文件的 URL。 
 text 用于存储文本数据，比如文章、评论、日志等。 ### DATETIME 和 TIMESTAMP 有什么区别？ 
 DATETIME 直接存储日期和时间的完整值，与时区无关。 
 TIMESTAMP 存储的是 Unix 时间戳，1970-01-01 00:00:01 UTC 以来的秒数，受时区影响。 
 
 另外，DATETIME 的默认值为 null，占用 8 个字节；TIMESTAMP 的默认值为当前时间——CURRENT_TIMESTAMP，占 4 个字节，实际开发中更常用，因为可以自动更新。 ### in 和 exists 的区别？ 
 当使用 IN 时，MySQL 会首先执行子查询，然后将子查询的结果集用于外部查询的条件。这意味着子查询的结果集需要全部加载到内存中。 
 而 EXISTS 会对外部查询的每一行，执行一次子查询。如果子查询返回任何行，则 EXISTS 条件为真。 EXISTS 关注的是子查询是否返回行，而不是返回的具体值。 
 -- IN 的临时表可能成为性能瓶颈 
 SELECT * FROM users 
 WHERE id IN ( SELECT user_id FROM orders WHERE amount > 100 ); 
 
 -- EXISTS 可以利用关联索引 
 SELECT * FROM users u 
 WHERE EXISTS ( SELECT 1 FROM orders o 
 WHERE o.user_id = u. id AND o.amount > 100 ); 
 IN 适用于子查询结果集较小的情况。如果子查询返回大量数据， IN 的性能可能会下降，因为它需要将整个结果集加载到内存。 
 而 EXISTS 适用于子查询结果集可能很大的情况。由于 EXISTS 只需要判断子查询是否返回行，而不需要加载整个结果集，因此在某些情况下性能更好，特别是当子查询可以使用索引时。 
 
 NULL值陷了解吗？ 
 IN : 如果子查询的结果集中包含 NULL 值，可能会导致意外的结果。例如， WHERE column IN (subquery) ，如果 subquery 返回 NULL ，则 column IN (subquery) 永远不会为真，除非 column 本身也为 NULL 。 
 EXISTS : 对 NULL 值的处理更加直接。 EXISTS 只是检查子查询是否返回行，不关心行的具体值，因此不受 NULL 值的影响。 ### 记录货币用什么类型比较好？ 
 如果是电商、交易、账单等涉及货币的场景，建议使用 DECIMAL 类型，因为 DECIMAL 类型是精确数值类型，不会出现浮点数计算误差。 
 例如， DECIMAL(19,4) 可以存储最多 19 位数字，其中 4 位是小数。 
 CREATE TABLE orders ( 
 id INT AUTO_INCREMENT, 
 amount DECIMAL ( 19 , 4 ), 
 PRIMARY KEY ( id ) 
 ); 
 如果是银行，涉及到支付的场景，建议使用 BIGINT 类型。可以将货币金额乘以一个固定因子，比如 100，表示以“分”为单位，然后存储为 BIGINT 。这种方式既避免了浮点数问题，同时也提供了不错的性能。但在展示的时候需要除以相应的因子。 
 
 为什么不推荐使用 FLOAT 或 DOUBLE？ 
 因为 FLOAT 和 DOUBLE 都是浮点数类型，会存在精度问题。 
 在许多编程语言中， 0.1 + 0.2 的结果会是类似 0.30000000000000004 的值，而不是预期的 0.3 。 ### 怎么存储 emoji? 
 因为 emoji（😊）是 4 个字节的 UTF-8 字符，而 MySQL 的 utf8 字符集只支持最多 3 个字节的 UTF-8 字符，所以在 MySQL 中存储 emoji 时，需要使用 utf8mb4 字符集。 
 ALTER TABLE mytable CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; 
 MySQL 8.0 已经默认支持 utf8mb4 字符集，可以通过 SHOW VARIABLES WHERE Variable_name LIKE 'character\_set\_%' OR Variable_name LIKE 'collation%'; 查看。 ### drop、delete 与 truncate 的区别？ 
 DROP 是物理删除，用来删除整张表，包括表结构，且不能回滚。 
 DELETE 支持行级删除，可以带 WHERE 条件，可以回滚。 
 TRUNCATE 用于清空表中的所有数据，但会保留表结构，不能回滚。 ### UNION 与 UNION ALL 的区别？ 
 UNION 会自动去除合并后结果集中的重复行。UNION ALL 不会去重，会将所有结果集合并起来。 ### count(1)、count(*) 与 count(列名) 的区别？ 
 在 InnoDB 引擎中， COUNT(1) 和 COUNT(*) 没有区别，都是用来统计所有行，包括 NULL。 
 如果表有索引， COUNT(*) 会直接用索引统计，而不是全表扫描，而 COUNT(1) 也会被 MySQL 优化为 COUNT(*) 。 
 COUNT(列名) 只统计列名不为 NULL 的行数。 
 -- 假设 users 表：
+----+-------+------------+
| id | name | email |
+----+-------+------------+
| 1 | 张三 | zhang@xx.com |
| 2 | 李四 | NULL |
| 3 | 王二 | wang@xx.com |
+----+-------+------------+

-- COUNT(*)
SELECT COUNT(*) FROM users;
-- 结果：3 （统计所有行）

-- COUNT(1)
SELECT COUNT(1) FROM users;
-- 结果：3 （统计所有行）

-- COUNT(email)
SELECT COUNT(email) FROM users;
-- 结果：2 （NULL 不计入统计） 
 这里解释一下，假设有这样一张表： 
 CREATE TABLE t1 ( 
 id INT , 
 name VARCHAR ( 50 ), 
 value INT 
 ); 
 插入的数据为： 
 INSERT INTO t1 VALUES 
 ( 1 , 'A' , 10 ), 
 ( 2 , 'B' , NULL ), -- NULL in value column 
 ( 3 , 'C' , 30 ), 
 ( 4 , NULL , 40 ), -- NULL in name column 
 ( 5 , 'E' , NULL ); -- NULL in value column 
 因为 id 列没有索引，所以 select count(*) 是全表扫描。 
 
 然后我们给 id 列加上索引。 
 alter table t1 add primary key ( id ); 
 
 再来看一下 select count(*) ，发现用了索引（MySQL 默认为给主键添加索引）。 
 
 另外，MySQL 8.0 官方手册有明确说明，InnoDB 引擎对 SELECT COUNT(*) 和 SELECT COUNT(1) 的处理方式完全一致，性能并无差异。 ### SQL 查询语句的执行顺序了解吗？ 
 了解。先执行 FROM 确定主表，再执行 JOIN 连接，然后 WHERE 进行过滤，接着 GROUP BY 进行分组，HAVING 过滤聚合结果，SELECT 选择最终列，ORDER BY 排序，最后 LIMIT 限制返回行数。 
 WHERE 先执行是为了减少数据量，HAVING 只能过滤聚合数据，ORDER BY 必须在 SELECT 之后排序最终结果，LIMIT 最后执行以减少数据传输。 
 
 
 
 
 执行顺序 
 SQL 关键字 
 作用 
 
 
 
 
 ① 
 FROM 
 确定主表，准备数据 
 
 
 ② 
 ON 
 连接多个表的条件 
 
 
 ③ 
 JOIN 
 执行 INNER JOIN / LEFT JOIN 等 
 
 
 ④ 
 WHERE 
 过滤行数据（提高效率） 
 
 
 ⑤ 
 GROUP BY 
 进行分组 
 
 
 ⑥ 
 HAVING 
 过滤聚合后的数据 
 
 
 ⑦ 
 SELECT 
 选择最终返回的列 
 
 
 ⑧ 
 DISTINCT 
 进行去重 
 
 
 ⑨ 
 ORDER BY 
 对最终结果排序 
 
 
 ⑩ 
 LIMIT 
 限制返回行数 
 
 
 
 这个执行顺序与编写 SQL 语句的顺序不同，这也是为什么有时候在 SELECT 子句中定义的别名不能在 WHERE 子句中使用得原因，因为 WHERE 是在 SELECT 之前执行的。 
 
 LIMIT 为什么在最后执行？ 
 因为 LIMIT 是在最终结果集上执行的，如果在 WHERE 之前执行 LIMIT，那么就会先返回所有行，然后再进行 LIMIT 限制，这样会增加数据传输的开销。 
 
 
 ORDER BY 为什么在 SELECT 之后执行？ 
 因为排序需要基于最终返回的列，如果 ORDER BY 早于 SELECT 执行，计算 COUNT(*) 之类的聚合函数就会出问题。 
 SELECT name, COUNT ( * ) AS order_count 
 FROM orders 
 GROUP BY name 
 ORDER BY order_count DESC ; ### 介绍一下 MySQL 的常用命令（补充） 
 
 2024 年 03 月 13 日增补。 
 
 
 MySQL 的常用命令主要包括数据库操作命令、表操作命令、行数据 CRUD 命令、索引和约束的创建修改命令、用户和权限管理的命令、事务控制的命令等。 
 
 说说数据库操作命令？ 
 CREATE DATABASE database_name; 用于创建数据库； DROP DATABASE database_name; 用于删除数据库； SHOW DATABASES; 用于显示所有数据库； USE database_name; 用于切换数据库。 
 
 
 说说表操作命令？ 
 CREATE TABLE table_name (列名1 数据类型1, 列名2 数据类型2,...); 用于创建表； DROP TABLE table_name; 用于删除表； SHOW TABLES; 用于显示所有表； DESCRIBE table_name; 用于查看表结构； ALTER TABLE table_name ADD column_name datatype; 用于修改表。 
 
 
 说说行数据的 CRUD 命令？ 
 INSERT INTO table_name (column1, column2, ...) VALUES (value1, value2, ...); 用于插入数据； SELECT column_names FROM table_name WHERE condition; 用于查询数据； UPDATE table_name SET column1 = value1, column2 = value2 WHERE condition; 用于更新数据； DELETE FROM table_name WHERE condition; 用于删除数据。 
 
 
 说说索引和约束的创建修改命令？ 
 CREATE INDEX index_name ON table_name (column_name); 用于创建索引； ALTER TABLE table_name ADD PRIMARY KEY (column_name); 用于添加主键； ALTER TABLE table_name ADD CONSTRAINT fk_name FOREIGN KEY (column_name) REFERENCES parent_table (parent_column_name); 用于添加外键。 
 
 
 说说用户和权限管理的命令？ 
 CREATE USER 'username'@'host' IDENTIFIED BY 'password'; 用于创建用户； GRANT ALL PRIVILEGES ON database_name.table_name TO 'username'@'host'; 用于授予权限； REVOKE ALL PRIVILEGES ON database_name.table_name FROM 'username'@'host'; 用于撤销权限； DROP USER 'username'@'host'; 用于删除用户。 
 
 
 说说事务控制的命令？ 
 START TRANSACTION; 用于开始事务； COMMIT; 用于提交事务； ROLLBACK; 用于回滚事务。 ### MySQL bin 目录下的可执行文件了解吗（补充） 
 
 2024 年 03 月 13 日增补 
 
 了解的。MySQL 的 bin 目录下有很多可执行文件，主要用于管理 MySQL 服务器、数据库、表、数据等。比如说： 
 
 mysql：用于连接 MySQL 服务器 
 mysqldump：用于数据库备份，对数据备份、迁移或恢复时非常有用 
 mysqladmin：用来执行一些管理操作，比如说创建数据库、删除数据库、查看 MySQL 服务器的状态等。 
 mysqlcheck：用于检查、修复、分析和优化数据库表，对数据库的维护和性能优化非常有用。 
 mysqlimport：用于从文本文件中导入数据到数据库表中，适合批量数据导入。 
 mysqlshow：用于显示 MySQL 数据库服务器中的数据库、表、列等信息。 
 mysqlbinlog：用于查看 MySQL 二进制日志文件的内容，可以用于恢复数据、查看数据变更等。 ### MySQL 第 3-10 条记录怎么查？（补充） 
 
 2024 年 03 月 30 日增补 
 
 可以使用 limit 语句，结合偏移量和行数来实现。 
 SELECT * FROM table_name LIMIT 2 , 8 ; 
 limit 语句用于限制查询结果的数量，偏移量表示从哪条记录开始，行数表示返回的记录数量。 
 
 2：偏移量，表示跳过前两条记录，从第三条记录开始。 
 8：行数，表示从偏移量开始，返回 8 条记录。 
 
 偏移量是从 0 开始的，即第一条记录的偏移量是 0；如果想从第 3 条记录开始，偏移量就应该是 2。 ### 用过哪些 MySQL 函数？（补充） 
 
 2024 年 04 月 12 日增补 
 
 用过挺多的，比如说处理字符串的函数： 
 
 CONCAT() : 用于连接两个或多个字符串。 
 LENGTH() : 用于返回字符串的长度。 
 SUBSTRING() : 从字符串中提取子字符串。 
 REPLACE() : 替换字符串中的某部分。 
 TRIM() : 去除字符串两侧的空格或其他指定字符。 
 
 实测数据： 
 -- 连接字符串 
 SELECT CONCAT ( '沉默' , ' ' , '王二' ) AS concatenated_string; 
 
 -- 获取字符串长度 
 SELECT LENGTH ( '沉默 王二' ) AS string_length; 
 
 -- 提取子字符串 
 SELECT SUBSTRING( '沉默 王二' , 1 , 5 ) AS substring; 
 
 -- 替换字符串内容 
 SELECT REPLACE ( '沉默 王二' , '王二' , 'MySQL' ) AS replaced_string; 
 
 -- 去除字符串两侧的空格 
 SELECT TRIM ( ' 沉默 王二 ' ) AS trimmed_string; 
 处理数字的函数： 
 
 ABS() : 返回一个数的绝对值。 
 ROUND() : 四舍五入到指定的小数位数。 
 MOD() : 返回除法操作的余数。 
 
 实测数据： 
 -- 返回绝对值 
 SELECT ABS ( - 123 ) AS absolute_value; 
 
 -- 四舍五入 
 SELECT ROUND ( 123.4567 , 2 ) AS rounded_value; 
 
 -- 余数 
 SELECT MOD ( 10 , 3 ) AS modulus; 
 日期和时间处理函数： 
 
 NOW() : 返回当前的日期和时间。 
 CURDATE() : 返回当前的日期。 
 
 实测数据： 
 -- 返回当前日期和时间 
 SELECT NOW() AS current_date_time; 
 
 -- 返回当前日期 
 SELECT CURDATE() AS current_date ; 
 汇总函数： 
 
 SUM() : 计算数值列的总和。 
 AVG() : 计算数值列的平均值。 
 COUNT() : 计算某列的行数。 
 
 实测数据： 
 -- 创建一个表并插入数据进行聚合查询 
 CREATE TABLE sales ( 
 product_id INT , 
 sales_amount DECIMAL ( 10 , 2 ) 
 ); 
 
 INSERT INTO sales (product_id, sales_amount) VALUES ( 1 , 100.00 ); 
 INSERT INTO sales (product_id, sales_amount) VALUES ( 1 , 150.00 ); 
 INSERT INTO sales (product_id, sales_amount) VALUES ( 2 , 200.00 ); 
 
 -- 计算总和 
 SELECT SUM (sales_amount) AS total_sales FROM sales; 
 
 -- 计算平均值 
 SELECT AVG (sales_amount) AS average_sales FROM sales; 
 
 -- 计算总行数 
 SELECT COUNT ( * ) AS total_entries FROM sales; 
 逻辑函数： 
 
 IF() : 如果条件为真，则返回一个值；否则返回另一个值。 
 [[锁|CAS]]E : 根据一系列条件返回值。 
 
 -- IF函数 
 SELECT IF ( 1 > 0 , 'True' , 'False' ) AS simple_if; 
 
 -- CASE表达式 
 SELECT CASE WHEN 1 > 0 THEN 'True' ELSE 'False' END AS case_expression; ### 说说 SQL 的隐式数据类型转换？（补充） 
 
 2024 年 04 月 25 日增补 
 
 当一个整数和一个浮点数相加时，整数会被转换为浮点数。 
 SELECT 1 + 1.0 ; -- 结果为 2.0 
 当一个字符串和一个整数相加时，字符串会被转换为整数。 
 SELECT '1' + 1 ; -- 结果为 2 
 隐式转换会导致意想不到的结果，最好通过显式转换来规避。 
 SELECT CAST ( '1' AS SIGNED INTEGER ) + 1 ; -- 结果为 2 
 实际验证结果： ### 说说 SQL 的语法树解析？（补充） 
 
 2024 年 09 月 19 日增补 
 
 SQL 语法树解析是将 SQL 查询语句转换成抽象语法树 —— AST 的过程，是数据库引擎处理查询的第一步，也是防止 SQL 注入的重要手段。 
 通常分为 3 个阶段。 
 第一个阶段，词法分析：拆解 SQL 语句，识别关键字、表名、列名等。 
 ---这部分是帮助大家理解 start，面试中可不背--- 
 比如说： 
 SELECT id , name FROM users WHERE age > 18 ; 
 将会被拆解为： 
 [SELECT] [id] [,] [name] [FROM] [users] [WHERE] [age] [>] [18] [;] 
 ---这部分是帮助大家理解 end，面试中可不背--- 
 第二个阶段，语法分析：检查 SQL 是否符合语法规则，并构建抽象语法树。 
 ---这部分是帮助大家理解 start，面试中可不背--- 
 比如说上面的语句会被构建成如下的语法树： 
 SELECT
 / \
 Columns FROM
 / \ |
 id name users
 |
 WHERE
 |
 age > 18 
 或者这样表示： 
 SELECT
 ├── COLUMNS: id, name
 ├── FROM: users
 ├── WHERE
 │ ├── CONDITION: age > 18 
 ---这部分是帮助大家理解 end，面试中可不背--- 
 第三个阶段，语义分析：检查表、列是否存在，进行权限验证等。 
 ---这部分是帮助大家理解 start，面试中可不背--- 
 比如说执行： 
 SELECT id , name FROM users WHERE age > 'eighteen' ; 
 会报错： 
 ERROR: Column 'age' is INT, but 'eighteen' is STRING. 
 ---这部分是帮助大家理解 end，面试中可不背--- 
 
 
 
 
 
 
 
 
 数据库架构 ### 说说 MySQL 的基础架构？ 
 MySQL 采用分层架构，主要包括连接层、服务层、和存储引擎层。 
 
 ①、连接层主要负责客户端连接的管理，包括验证用户身份、权限校验、连接管理等。可以通过数据库连接池来提升连接的处理效率。 
 ②、服务层是 MySQL 的核心，主要负责查询解析、优化、执行等操作。在这一层，SQL 语句会经过解析、优化器优化，然后转发到存储引擎执行，并返回结果。这一层包含查询解析器、优化器、执行计划生成器、日志模块等。 
 ③、存储引擎层负责数据的实际存储和提取。MySQL 支持多种存储引擎，如 InnoDB、MyISAM、Memory 等。 
 
 binlog写入在哪一层？ 
 binlog 在服务层，负责记录 SQL 语句的变化。它记录了所有对数据库进行更改的操作，用于数据恢复、主从复制等。 ### 一条查询语句是如何执行的？ 
 当我们执行一条 SELECT 语句时，MySQL 并不会直接去磁盘读取数据，而是经过 6 个步骤来解析、优化、执行，然后再返回结果。 
 
 第一步，客户端发送 SQL 查询语句到 MySQL 服务器。 
 第二步，MySQL 服务器的连接器开始处理这个请求，跟客户端建立连接、获取权限、管理连接。 
 第三步，解析器对 SQL 语句进行解析，检查语句是否符合 SQL 语法规则，确保数据库、表和列都是存在的，并处理 SQL 语句中的名称解析和权限验证。 
 第四步，优化器负责确定 SQL 语句的执行计划，这包括选择使用哪些索引，以及决定表之间的连接顺序等。 
 第五步，执行器会调用存储引擎的 API 来进行数据的读写。 
 第六步，存储引擎负责查询数据，并将执行结果返回给客户端。客户端接收到查询结果，完成这次查询请求。 ### 一条更新语句是如何执行的？ 
 总的来说，一条 UPDATE 语句的执行过程包括读取数据页、加锁解锁、事务提交、日志记录等多个步骤。 
 
 拿 update test set a=1 where id=2 举例来说： 
 在事务开始前，MySQL 需要记录undo log，用于事务回滚。 
 
 
 
 操作 
 id 
 旧值 
 新值 
 
 
 
 
 update 
 2 
 N 
 1 
 
 
 
 除了记录 undo log，存储引擎还会将更新操作写入 redo log，状态标记为 prepare，并确保 redo log 持久化到磁盘。这一步可以保证即使系统崩溃，数据也能通过 redo log 恢复到一致状态。 
 写完 redo log 后，MySQL 会获取行锁，将 a 的值修改为 1，标记为脏页，此时数据仍然在内存的 buffer pool 中，不会立即写入磁盘。后台线程会在适当的时候将脏页刷盘，以提高性能。 
 最后提交事务，redo log 中的记录被标记为 committed，行锁释放。 
 如果 MySQL 开启了 binlog，还会将更新操作记录到 binlog 中，主要用于主从复制。 
 以及数据恢复，可以结合 redo log 进行点对点的恢复。binlog 的写入通常发生在事务提交时，与 redo log 共同构成“两阶段提交”，确保两者的一致性。 
 注意，redo log 的写入有两个阶段的提交，一是 binlog 写入之前 prepare 状态的写入，二是 binlog 写入之后 commit 状态的写入。 ### 说说 MySQL 的段区页行（补充） 
 
 2024 年 04 月 26 日增补 
 
 MySQL 是以表的形式存储数据的，而表空间的结构则由段、区、页、行组成。 
 
 ①、段：表空间由多个段组成，常见的段有数据段、索引段、回滚段等。 
 创建索引时会创建两个段，数据段和索引段，数据段用来存储叶子节点中的数据；索引段用来存储非叶子节点的数据。 
 回滚段包含了事务执行过程中用于数据回滚的旧数据。 
 ②、区：段由一个或多个区组成，区是一组连续的页，通常包含 64 个连续的页，也就是 1M 的数据。 
 使用区而非单独的页进行数据分配可以优化磁盘操作，减少磁盘寻道时间，特别是在大量数据进行读写时。 
 ③、页：页是 InnoDB 存储数据的基本单元，标准大小为 16 KB，索引树上的一个节点就是一个页。 
 也就意味着数据库每次读写都是以 16 KB 为单位的，一次最少从磁盘中读取 16KB 的数据到内存，一次最少写入 16KB 的数据到磁盘。 
 ④、行：InnoDB 采用行存储方式，意味着数据按照行进行组织和管理，行数据可能有多个格式，比如说 COMPACT、REDUNDANT、DYNAMIC 等。 
 MySQL 8.0 默认的行格式是 DYNAMIC，由COMPACT 演变而来，意味着这些数据如果超过了页内联存储的限制，则会被存储在溢出页中。 
 可以通过 show table status like '%article%' 查看行格式。 
 
 
 
 
 
 存储引擎
