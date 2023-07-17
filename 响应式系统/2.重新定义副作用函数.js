/* 
前情提要：
修改副作用函数
硬编码了副作用函数的名字（effect），导致一旦副作用函数的名字不叫 effect，
那么这段代码就不能正确地工作了。
1. 在读取obj.text的时候，我们会去收集相关的副作用函数，
但是在上一个版本的代码中，bucket.add()收集的是一个具体有具名函数，这个时候如果页面中散落了很多相关的副作用函数，难道
要在get读取的过程中一个个去add吗？
2.而且哪怕这个副作用函数是一个匿名函数，我们也应该让它能够被正确的进行add
*/

// 存储副作用函数的桶
const bucket = new Set();

// 原始数据
const data = { text: "hello world" };
// 对原始数据的代理
const obj = new Proxy(data, {
  get(target, key) {
    // 将activeEffect 中存储的副作用函数收集到 "桶"中
    if (activeEffect) {
      // 新增
      bucket.add(activeEffect);
    }
    return target[key];
  },
  set(target, key, newVal) {
    target[key] = newVal;
    bucket.forEach((fn) => fn());
    return true;
  },
});

// 用一个全局变量存储被注册的函数
let activeEffect;

// effect 函数用户注册副作用函数
function effect(fn) {
  // 当调用effect注册副作用函数时，将副作用函数fn赋值给 activeEffect
  activeEffect = fn;
  // 执行副作用函数
  fn();
}

effect(
  // 一个匿名的副作用函数
  () => {
    document.getElementById("effect1").innerText = obj.text;
    console.log("effect函数执行");
  }
);
// 1 秒后
setTimeout(() => {
  obj.text = "hello vue3";
  /* 
  设置obj一个不存在的属性时，副作用函数会effect会打印’effect函数执行‘
  obj.effect = 'hello effect'
*/
}, 1000);

/* 
优化：
1.重新设计effect函数，让它能够传一个函数fn进来，我们把这个函数fn传递给一个全局变量activeEffect，
并且执行这个fn函数。
2.在fn函数中触发了obj.text属性的读取操作，紧接着触发obj代理text的读取，那这个时候在读取函数内部
我们就可以直接去add activeEffect这个变量的函数，而不用一个个去添加那些硬编码函数了

缺陷：
1.在响应式数据 obj 上设置一个不存在的属性时，在匿名副作用函数内并没有读取该值。所以理论上该值并没有和副作用函数
建立联系。那么访问该值的时候，副作用函数就不应该被执行，实际上却执行了。

下回书：
1. 重新设计桶bucket的数据结构

*/
