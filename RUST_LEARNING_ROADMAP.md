# Rust 语法学习路线图

## 核心概念

### 1. 基础语法
- **变量与常量**
  - `let` 声明变量
  - `const` 声明常量
  - 可变与不可变
- **数据类型**
  - 标量类型：整数、浮点数、布尔值、字符
  - 复合类型：元组、数组
- **控制流**
  - `if` 表达式
  - `loop` 循环
  - `while` 循环
  - `for` 循环
  - 匹配 `match`

### 2. 所有权系统
- **所有权规则**
  - 每个值有且仅有一个所有者
  - 所有者离开作用域值被丢弃
  - 不可变借用 `&T`
  - 可变借用 `&mut T`
- **生命周期**
  - 借用的生命周期
  - 生命周期注解

### 3. 结构体与枚举
- **结构体**
  - 定义与实例化
  - 方法
  - 关联函数
- **枚举**
  - 定义与使用
  - `Option<T>` 与 `Result<T, E>`
  - 模式匹配

### 4. 模块系统
- **模块定义**
- **可见性**
- **路径**
- **use 语句**

### 5. 错误处理
- **panic!**
- **Result<T, E>**
- **? 运算符**
- **自定义错误**

### 6. 泛型与 Trait
- **泛型**
  - 泛型函数
  - 泛型结构体
- **Trait**
  - 定义与实现
  - 默认方法
  - 特征约束

### 7. 并发编程
- **线程**
- **消息传递**
- **共享状态**
- **无锁并发**

## 案例驱动学习

### 案例 1: Hello World
```rust
fn main() {
    println!("Hello, Rust!");
}
```

### 案例 2: 变量与类型
```rust
fn main() {
    // 不可变变量
    let x = 5;
    // 可变变量
    let mut y = 10;
    y = 15;
    
    // 类型标注
    let z: i32 = 20;
    let pi: f64 = 3.14;
    let is_true: bool = true;
    let c: char = 'R';
    
    println!("x: {}, y: {}, z: {}, pi: {}, is_true: {}, c: {}", x, y, z, pi, is_true, c);
}
```

### 案例 3: 控制流
```rust
fn main() {
    let number = 7;
    
    // if 表达式
    if number % 2 == 0 {
        println!("{} is even", number);
    } else {
        println!("{} is odd", number);
    }
    
    // loop 循环
    let mut counter = 0;
    let result = loop {
        counter += 1;
        if counter == 10 {
            break counter;
        }
    };
    println!("Loop result: {}", result);
    
    // while 循环
    let mut i = 0;
    while i < 5 {
        println!("While loop: {}", i);
        i += 1;
    }
    
    // for 循环
    let numbers = [1, 2, 3, 4, 5];
    for number in numbers.iter() {
        println!("For loop: {}", number);
    }
    
    // match 匹配
    let status = 200;
    match status {
        200 => println!("OK"),
        404 => println!("Not Found"),
        _ => println!("Other status"),
    }
}
```

### 案例 4: 所有权与借用
```rust
fn main() {
    // 所有权转移
    let s1 = String::from("hello");
    let s2 = s1; // s1 的所有权转移给 s2
    // println!("s1: {}", s1); // 编译错误，s1 不再拥有值
    println!("s2: {}", s2);
    
    // 不可变借用
    let s3 = String::from("world");
    let len = calculate_length(&s3);
    println!("Length of '{}' is {}", s3, len);
    
    // 可变借用
    let mut s4 = String::from("hello");
    change(&mut s4);
    println!("s4: {}", s4);
}

fn calculate_length(s: &String) -> usize {
    s.len()
}

fn change(s: &mut String) {
    s.push_str(", world");
}
```

### 案例 5: 结构体
```rust
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    // 关联函数
    fn square(size: u32) -> Self {
        Self {
            width: size,
            height: size,
        }
    }
    
    // 方法
    fn area(&self) -> u32 {
        self.width * self.height
    }
    
    fn can_hold(&self, other: &Rectangle) -> bool {
        self.width > other.width && self.height > other.height
    }
}

fn main() {
    let rect1 = Rectangle {
        width: 30,
        height: 50,
    };
    
    let rect2 = Rectangle {
        width: 10,
        height: 40,
    };
    
    let square = Rectangle::square(20);
    
    println!("rect1 area: {}", rect1.area());
    println!("rect1 can hold rect2: {}", rect1.can_hold(&rect2));
    println!("square area: {}", square.area());
}
```

### 案例 6: 枚举与模式匹配
```rust
enum Option<T> {
    Some(T),
    None,
}

enum Result<T, E> {
    Ok(T),
    Err(E),
}

fn divide(numerator: f64, denominator: f64) -> Result<f64, String> {
    if denominator == 0.0 {
        Err(String::from("Division by zero"))
    } else {
        Ok(numerator / denominator)
    }
}

fn main() {
    // Option 用法
    let some_number = Some(5);
    let no_number: Option<i32> = None;
    
    match some_number {
        Some(n) => println!("Some: {}", n),
        None => println!("None"),
    }
    
    // Result 用法
    let result = divide(10.0, 2.0);
    match result {
        Ok(value) => println!("Result: {}", value),
        Err(error) => println!("Error: {}", error),
    }
    
    // ? 运算符
    fn print_result() -> Result<(), String> {
        let value = divide(10.0, 0.0)?;
        println!("Value: {}", value);
        Ok(())
    }
    
    if let Err(e) = print_result() {
        println!("Print result error: {}", e);
    }
}
```

### 案例 7: 模块系统
```rust
// src/lib.rs
mod utils {
    pub mod math {
        pub fn add(a: i32, b: i32) -> i32 {
            a + b
        }
        
        fn subtract(a: i32, b: i32) -> i32 {
            a - b
        }
    }
}

use utils::math::add;

fn main() {
    let sum = add(5, 3);
    println!("Sum: {}", sum);
    // let diff = utils::math::subtract(5, 3); // 编译错误，subtract 是私有的
}
```

### 案例 8: 泛型与 Trait
```rust
// 泛型函数
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in list {
        if item > largest {
            largest = item;
        }
    }
    largest
}

// Trait 定义
trait Summary {
    fn summarize(&self) -> String;
    
    // 默认方法
    fn summarize_default(&self) -> String {
        String::from("(Read more...)")
    }
}

// 实现 Trait
struct NewsArticle {
    headline: String,
    location: String,
    author: String,
    content: String,
}

impl Summary for NewsArticle {
    fn summarize(&self) -> String {
        format!("{}, by {} ({})", self.headline, self.author, self.location)
    }
}

struct Tweet {
    username: String,
    content: String,
    reply: bool,
    retweet: bool,
}

impl Summary for Tweet {
    fn summarize(&self) -> String {
        format!("{}: {}", self.username, self.content)
    }
}

// Trait 约束
fn notify<T: Summary>(item: &T) {
    println!("Breaking news! {}", item.summarize());
}

fn main() {
    // 泛型函数使用
    let numbers = vec![34, 50, 25, 100, 65];
    let result = largest(&numbers);
    println!("Largest number: {}", result);
    
    let chars = vec!['y', 'm', 'a', 'q'];
    let result = largest(&chars);
    println!("Largest char: {}", result);
    
    // Trait 使用
    let article = NewsArticle {
        headline: String::from("Penguins win the Stanley Cup Championship"),
        location: String::from("Pittsburgh, PA, USA"),
        author: String::from("Iceburgh"),
        content: String::from("The Pittsburgh Penguins once again are the best hockey team in the NHL."),
    };
    
    let tweet = Tweet {
        username: String::from("horse_ebooks"),
        content: String::from("of course, as you probably already know, people"),
        reply: false,
        retweet: false,
    };
    
    println!("Article summary: {}", article.summarize());
    println!("Tweet summary: {}", tweet.summarize());
    println!("Article default: {}", article.summarize_default());
    
    notify(&article);
    notify(&tweet);
}
```

### 案例 9: 错误处理
```rust
use std::fs::File;
use std::io::{self, Read};

// 自定义错误类型
#[derive(Debug)]
enum CustomError {
    FileError(io::Error),
    ParseError(String),
}

impl From<io::Error> for CustomError {
    fn from(err: io::Error) -> Self {
        CustomError::FileError(err)
    }
}

// 使用 ? 运算符处理错误
fn read_username_from_file() -> Result<String, CustomError> {
    let mut file = File::open("username.txt")?;
    let mut username = String::new();
    file.read_to_string(&mut username)?;
    Ok(username)
}

// 传播错误
fn get_username() -> Result<String, CustomError> {
    let username = read_username_from_file()?;
    if username.len() < 3 {
        return Err(CustomError::ParseError(String::from("Username too short")));
    }
    Ok(username)
}

fn main() {
    match get_username() {
        Ok(username) => println!("Username: {}", username),
        Err(e) => println!("Error: {:?}", e),
    }
}
```

### 案例 10: 并发编程
```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn main() {
    // 消息传递
    let (tx, rx) = mpsc::channel();
    
    thread::spawn(move || {
        let messages = vec![
            String::from("Hello"),
            String::from("from"),
            String::from("the"),
            String::from("thread"),
        ];
        
        for msg in messages {
            tx.send(msg).unwrap();
            thread::sleep(Duration::from_secs(1));
        }
    });
    
    for received in rx {
        println!("Got: {}", received);
    }
    
    // 共享状态
    use std::sync::Mutex;
    use std::sync::Arc;
    
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];
    
    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            let mut num = counter.lock().unwrap();
            *num += 1;
        });
        handles.push(handle);
    }
    
    for handle in handles {
        handle.join().unwrap();
    }
    
    println!("Result: {}", *counter.lock().unwrap());
}
```

## 与 Java 对比

| 特性 | Rust | Java |
|------|------|------|
| 变量声明 | `let` (不可变), `let mut` (可变) | `var` (可变), `final` (不可变) |
| 类型系统 | 静态类型，类型推断 | 静态类型，类型推断 |
| 内存管理 | 所有权系统，无垃圾回收 | 垃圾回收 |
| 错误处理 | `Result<T, E>` 和 `panic!` | 异常 |
| 结构体 | `struct` | `class` |
| 继承 | 无，使用 trait | 有 |
| 并发 | 所有权系统保证安全 | `synchronized` 和 `volatile` |
| 包管理 | Cargo | Maven/Gradle |

## 学习资源

1. **官方文档**：[The Rust Programming Language](https://doc.rust-lang.org/book/)
2. **练习**：[Rustlings](https://github.com/rust-lang/rustlings)
3. **在线编译器**：[Rust Playground](https://play.rust-lang.org/)
4. **社区**：[Rust Forum](https://users.rust-lang.org/)
5. **书籍**：
   - 《Rust 程序设计语言》
   - 《Programming Rust》
   - 《Rust in Action》

## 实践项目

1. **命令行工具**：创建一个简单的命令行工具，如文件查找器
2. **Web 服务**：使用 Actix 或 Rocket 框架创建一个 Web 服务
3. **系统工具**：创建一个文件系统工具，如批量重命名
4. **游戏**：创建一个简单的终端游戏

通过这些案例和练习，你可以快速熟悉 Rust 的核心语法和特性。记住，Rust 的学习曲线可能比 Java 陡峭，但一旦掌握，你会发现它是一种非常强大和安全的语言。