/*

前情提要：
在上一版中，我们在setTimeOut函数中设置一个obj上原来不存在的函数，触发了代理obj的set函数，这个时候就会去执行副作用函数，
而理论上来说，该副作用函数是针对obj.text属性的，不对obj.text操作行为的事件是不应该触发的


修改桶的数据结构
在副作用函数与被操作的目标字段之间建立明确的联系
● WeakMap由target-->Map构成
● Map由key--> Set构成 

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
     // 没有activeEffect，直接return
     if(!activeEffect) return target[key]
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
    // 返回属性值
    return target[key];
  },
  // 拦截设置操作
  set(target, key, newVal) {
    // 设置属性值
    target[key] = newVal;
    // 根据target从桶中取得depsMap，它是 key-->effects
    const depsMap = bucket.get(target);
    if (!depsMap) return;
    // 根据key 所取得所有副作用函数 effects
    const effects = depsMap.get(key);
    //执行副作用函数
    effects && effects.forEach((fn) => fn());
  },
});

effect(
  // 一个匿名的副作用函数
  () => {
    document.getElementById("effect1").innerText = obj.text;
  }
);
// 1 秒后
setTimeout(() => {
  obj.text = "hello vue3";
}, 1000);

/* 
重新设计桶bucket的数据结构，让obj-->text-->effect对应起来，每个obj属性里收集各自的副作用函数
1. bucket(weakMap):obj --> depsMap;
2. depsMap(map):text --> deps(set);
3.deps(set): ('fn')
其实最终的数据结构类似：
{
  obj:{
    text:['fn']
  }
}



*/
