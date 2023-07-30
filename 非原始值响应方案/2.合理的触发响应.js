// 存储副作用函数的桶
const bucket = new WeakMap();
// 用一个全局变量存储被注册的函数
let activeEffect;
// effect 栈
const effectStack = [];
const ITERATE_KEY = Symbol()
const TriggerType = {
   SET: 'SET',
   ADD: 'ADD',
   DELETE: 'DELETE'
 }
// 原始数据
const data = { ok: true, text: "hello world", foo: 1, bar: 2 };
// 对原始数据的代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key,receiver) {
    // 代理对象可以通过 raw 属性访问原始数据
    if (key === 'raw') {
      return target
    }
    track(target, key);
    // 返回属性值
    return Reflect.get(target,key,receiver)
  },
  set(target, key, newVal, receiver) {
    // 先获取旧值
    const oldVal = target[key]

    // 如果属性不存在，则说明是添加新属性，否则是设置已有属性
    const type = Object.prototype.hasOwnProperty.call(target,key)?'SET':'ADD'

    // 设置属性值
    const res = Reflect.set(target, key, newVal, receiver);

   // target === receiver.raw 说明 receiver 就是 target 的代理对象
    if (target === receiver.raw) {
       // 比较新值与旧值，只有当它们不全等，并且不都是 NaN 的时候才触发响应
      if(oldVal !== newVal && (oldVal === oldVal || newVal === newVal)){
        trigger(target,key,type)
      }
   
    }
   
   
    return res;
  },
  //  has 拦截函数实现对 in 操作符的代理
  has(target, key) {
    track(target, key);
    return Reflect.has(target, key);
  },
  // 使用 ownKeys 拦截函数来拦截Reflect.ownKeys 操作
  ownKeys(target) {
    // 将副作用函数与 ITERATE_KEY 关联
    track(target, ITERATE_KEY);
    return Reflect.ownKeys(target);
  },
  deleteProperty(target, key) {
    // 检查被操作的属性是否是对象自己的属性
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    // 使用 Reflect.deleteProperty 完成属性的删除
    const res = Reflect.deleteProperty(target, key)

    if (res && hadKey) {
      // 只有当被删除的属性是对象自己的属性并且成功删除时，才触发更新
      trigger(target, key, 'DELETE')
    }

    return res
  }
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
function trigger(target, key,type) {
  // 根据target从桶中取得depsMap，它是 key-->effects
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 取得与key相关联的副作用函数
  const effects = depsMap.get(key);


  //执行副作用函数
  const effectsToRun = new Set();

  //将与key相关联的副作用函数添加到effectsToRun
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });

  if(type === 'ADD' || type=== 'DELETE'){
    // 只有当操作类型 type 为 'ADD' 时，才会触发与 ITERATE_KEY 相关联的副作用函数重新执行，这样就避免了不必要的性能损耗
    
    // 取得与ITERATE_KEY相关联的副作用函数
    const iterateEffects = depsMap.get(ITERATE_KEY);

    //将与iterateEffects相关联的副作用函数也添加到effectsToRun
    iterateEffects &&
    iterateEffects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  }  

 

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

// 执行副作用函数，触发读取
const effectFn = effect(
  // 一个匿名的副作用函数
  () => {
    document.getElementById("effect1").innerText = obj.text;
 
  },

  {
    // 调度器 scheduler 是一个函数
    scheduler(fn) {},
    lazy: true,
  }
);

effectFn();
// value 是getter的返回值
const value = effectFn();
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



function traverse(value, seen = new Set()) {
  // 如果要读取的数据是原始值，或者已经被被读取过了，那么什么都不做
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  // 将数据添加到 seen 中，代表遍历地读取过了。避免循环引用引起的死循环
  seen.add(value);
  // 暂时不考虑数组等其他结构
  // 假设value 就是一个对象, 使用for...in 读取对象的每一个值，并递归地调用 traverse 进行处理
  for (const k in value) {
    traverse(value[k], seen);
  }

  return value;
}
function watch(source, cb, options = {}) {
  // 定义getter
  let getter;
  //如果source是函数，说明用户传递的是getter，所以直接把source赋值给getter
  if (typeof source === "function") {
    getter = source;
  } else {
    // 否则按照原来的实现调用 traverse递归读取
    getter = () => traverse(source);
  }
  //定义旧值和新值
  let oldValue, newValue;

  // 提取scheduler调度函数为一个独立的job函数
  const job = () => {
    newValue = effectFn();
    cb(newValue, oldValue);
    oldValue = newValue;
  };
  //使用 effect注册副作用函数时，开启lazy选项，并把返回值存储到effectFn中以便后续手动调用
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: job,
  });
  if (options?.immediate) {
    //当immediate为true时立即执行job，从而触发回调执行
    job();
  } else {
    //手动调用副作用函数，拿到的值就是旧值
    oldValue = effectFn();
  }
}
watch(obj, () => {
  console.log("数据变化了");
});

// 1 秒后
setTimeout(() => {
  obj.text = "hello vue3";
}, 1000);



