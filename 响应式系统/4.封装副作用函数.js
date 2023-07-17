/* 
前情提要：
1.上回书说到，我们重新定义了桶的数据结构，并且用weakmap代替了map

这回为了遵循函数单一职责，把get时的操作封装到了track函数中，
把set函数封装到了trigger函数中。

*/

// 从存储副作用函数的桶
const bucket = new WeakMap();

// 用一个全局变量存储被注册的函数
let activeEffect;

// effect 函数用户注册副作用函数
function effect(fn) {
  // 当调用effect注册副作用函数时，将副作用函数fn赋值给 activeEffect
  activeEffect = fn;
  // 执行副作用函数
  fn();
}

// 原始数据
const data = { text: "hello world" };

const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    track(target, key);
    // 返回属性值
    return target[key];
  },
  // 拦截设置操作
  set(target, key, newVal) {
    // 设置属性值
    target[key] = newVal;
    trigger(target, key);
  },
});

// 在get 拦截函数内调用 track函数追踪变化
function track(target, key) {
  // 更新 target从 "桶"中取得 depsMap,它也是一个Map类型：key --> effects
  let depsMap = bucket.get(target);
  //如果不存在depsMap，那么新建一个Map 并与target关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  // 在根据 key 从 depsMap 中取得deps,它是一个Set类型
  // 里面存储着所有与当前key相关联的副作用函数：effects
  let deps = depsMap.get(key);
  //如果deps不存在，同样新建一个Set并与key关联
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  // 最后将当前激活的副作用函数添加到 "桶里"
  deps.add(activeEffect);
}

//在set 拦截函数内调用trigger 函数触发变化
function trigger(target, key) {
  // 根据target从桶中取得depsMap，它是 key-->effects
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 根据key 所取得所有副作用函数 effects
  const effects = depsMap.get(key);
  //执行副作用函数
  effects && effects.forEach((fn) => fn());
}
effect(
  // 一个匿名的副作用函数
  () => {
    document.body.innerText = obj.text;
  }
);
// 1 秒后
setTimeout(() => {
  obj.text = "hello vue3";
}, 1000);
