// 从存储副作用函数的桶
const bucket = new WeakMap();

// 原始数据
const data = { foo: 1, bar: 2 };

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
    const res = fn();

    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把activeEffect还原为之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];

    // 将res 作为effectFn 的返回值
    return res;
  };
  // 将options 挂载到effectFn上
  effectFn.options = options;
  // effectFn.deps 用来存储所有与该副作用相关联的依赖集合
  effectFn.deps = [];
  // 只有非 lazy的时候，才执行
  if (!options.lazy) {
    // 执行副作用函数
    effectFn();
  }
  // 将副作用函数作为返回值返回
  return effectFn;
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

/* const effectFn = effect(
  // getter 返回obj.foo 与obj.bar 的和
  () => obj.foo + obj.bar,
  //options
  {
    // // 调度器 scheduler 是一个函数
    // scheduler(fn) {},
    lazy: true,
  }
);
// value 是getter的返回值
const value = effectFn();
console.log(value); */

function computed(getter) {
  // value 用来缓存上一次计算的值
  let value;
  // dirty 标志，用来标识是否需要重新计算值，为true则意味着“脏”，需要计算
  let dirty = true;

  // 把getter 作为副作用函数，创建一个lazy的effect
  const effectFn = effect(getter, {
    lazy: true,
    // 添加调度器，在调度器中将 dirty 重置为true
    scheduler() {
      if (!dirty) {
        dirty = true;
        // 当计算属性依赖的响应式数据变化时，手动调用trigger 函数触发响应
        trigger(obj, "value");
      }
    },
  });

  const obj = {
    get value() {
      // 只有“脏”时才计算值，并将得到的值缓存到value中
      if (dirty) {
        value = effectFn();
        // 将 dirty 设置为false，下一次访问直接使用缓存到 value 中的值
        dirty = false;
      }
      // 当读取value时，手动调用 track函数进行追踪
      track(obj, "value");
      return value;
    },
  };
  return obj;
}

const sumRes = computed(() => {
  return obj.foo + obj.bar;
});

effect(() => {
  // 在该副作用函数中读取sumRes。value
  console.log(sumRes.value);
});
// 修改 obj.foo
obj.foo++;
