/* 
基础的响应式系统
*/

function effect() {
  // effect 函数的执行会读取 obj.text
  document.getElementById("effect1").innerText = obj.text;
}

// 存储副作用函数的桶
const bucket = new Set();

// 原始数据
const data = { text: "hello world" };
// 对原始数据的代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    // 将副作用函数effect添加到存储副作用函数的捅中
    bucket.add(effect);
    // bucket.add(effect2);
    return target[key];
  },
  // 拦截设置操作
  set(target, key, newVal) {
    // 设置属性的值
    target[key] = newVal;
    // 把副作用函数从桶里取出并执行
    bucket.forEach((fn) => fn());
    // 返回true 代表设置操作成功
    return true;
  },
});

// 执行副作用函数，触发读取
effect();

// 1 秒后
setTimeout(() => {
  obj.text = "hello vue3";
}, 1000);

/* 
tip:
- effect副作用函数是用来执行页面中的赋值操作，那么我们只要在设置obj.text值的时候，
让effect函数重新执行就好了：

1.要在设置obj.text值做某些操作，要用到Proxy代理obj的写操作，当obj有写操作的时候，重新执行effect;
2.由于可能一个obj有多个不同的副作用函数，比如在vue的template中在不同地方读取obj.text，然后有可能又在不同的函数中设置obj.text。
所以要在读取obj.text的时候把obj.text对应的所有副作用函数收集起来，在设置的时候统一去执行收集的副作用函数

缺陷:
- 我们直接通过名字（effect）来获取副作用函数，这种硬编码的方式很不灵活。副作用函数的名字可以任意取，我们完全可以把副作用函数命名为 myEffect，
甚至是一个匿名函数，因此我们要想办法去掉这种硬编码的机制

*/
