/* 
前情提要：
1.前面重新设计了桶结构，封装了track 和trigger函数

但是目前还是存在一个问题，就是分支切换中带来的不必要的更新
*/


// 从存储副作用函数的桶
const bucket = new WeakMap();

// 原始数据
const data = { ok: true, text: "hello world" };

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
   // 没有activeEffect,直接return
   if(!activeEffect) return
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
  // deps 就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到activeEffect.deps数组中
  activeEffect.deps?.push(deps);
}

//在set 拦截函数内调用trigger 函数触发变化
function trigger(target, key) {
  // 根据target从桶中取得depsMap，它是 key-->effects
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 根据key 所取得所有副作用函数 effects
  const effects = depsMap.get(key);

  const effectsToRun = new Set(effects);
  // effects && effects.forEach((effectFn) => effectsToRun.add(effectFn));
  effectsToRun.forEach((effectFn) => effectFn());
  //执行副作用函数
  // effects && effects.forEach((fn) => fn());
}

// 用一个全局变量存储被注册的函数
let activeEffect;

// effect 函数用户注册副作用函数
function effect(fn) {
  const effectFn = () => {
    // 调用cleanup函数完成清除工作
    cleanup(effectFn);
    // 当调effectFn 执行时，将其设置为当前激活的副作用函数

    activeEffect = effectFn;
    // 执行副作用函数
    fn();
  };
  // effectFn.deps 用来存储所有与该副作用相关联的依赖集合
  effectFn.deps = [];
  // 执行副作用函数
  effectFn();
}
function cleanup(effectFn) {
  // 遍历 effectFn.deps 数组
  for (let i = 0; i < effectFn.length; i++) {
    // deps 是依赖集合
    const deps = effectFn.deps[i];
    // 将effectFn 从依赖集合中移除
    deps.delete(effectFn);
  }
  // 最后需要重置effectFn.deps 数组
  effectFn.deps.length = 0;
}
effect(
  // 一个匿名的副作用函数
  () => {
    console.log("effect副作用函数执行");

    document.body.innerText = obj.ok ? obj.text : "not";
  }
);
setTimeout(() => {
  obj.ok = false;
  setTimeout(() => {
    obj.text = "hello vue3";
  }, 1000);
}, 1000);


/* 
小结：
1. 在这里我们修复了分支切换中的不必要更新，
每次副作用函数执行时，我们可以先把它从所有与之关联的依赖集合中删除

*/