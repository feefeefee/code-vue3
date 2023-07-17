// 从存储副作用函数的桶
const bucket = new WeakMap();

// 原始数据
const data = { foo: 1 };

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
  // deps 就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到activeEffect.deps数组中
  activeEffect?.deps?.push(deps);
}

//在set 拦截函数内调用trigger 函数触发变化
function trigger(target, key) {
  // 根据target从桶中取得depsMap，它是 key-->effects
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 根据key 所取得所有副作用函数 effects
  const effects = depsMap.get(key);

  const effectsToRun = new Set();
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  effectsToRun.forEach((effectFn) => {
    // 如果一个副作用函数存在调度器，则调用改调度器，并将该副作用函数作为参数传递
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      // 否则直接执行副作用函数
      effectFn();
    }
  });
}

// 用一个全局变量存储被注册的函数
let activeEffect;
// effect 栈
const effectStack = [];

// effect 函数用户注册副作用函数
function effect(fn, options = {}) {
  const effectFn = () => {
    // 调用cleanup函数完成清除工作
    cleanup(effectFn);
    // 当调effectFn 执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn;
    // 在调用副作用函数之前奖当前副作用函数压入栈中
    effectStack.push(effectFn);
    // 执行副作用函数
    fn();

    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把activeEffect还原为之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  };
  // 将options 挂载到effectFn上
  effectFn.options = options;
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
// 定义一个任务队列
const jobQueue = new Set();
//使用 Promise。resolve()创建一个promise实例，我们用它将一个任务添加到微任务队列
const p = Promise.resolve();

// 一个标志代表是否正在刷新队列
let isFlushing = false;
function flushJob() {
  // 如果队列正在刷新，则什么都不做
  if (isFlushing) return;
  // 设置true,代表正在刷新
  isFlushing = true;
  //在微任务队列中刷新jobQueue 队列
  p.then(() => {
    jobQueue.forEach((job) => job());
  }).finally(() => {
    // 结束后重置 isFlushing
    isFlushing = false;
  });
}

effect(
  () => {
    console.log(obj.foo);
  },
  //options
  {
    // 调度器 scheduler 是一个函数
    scheduler(fn) {
      // 将副作用函数放到宏任务队列中执行
      // setTimeout(fn);
      // 每次调度时，将副作用哈函数添加到 jobQueue队列中
      jobQueue.add(fn);
      flushJob();
    },
  }
);

obj.foo++;
obj.foo++;
