 // 定义一个 Map 实例，存储原始对象到代理对象的映射
 const reactiveMap = new Map()

function reactive(obj) {
  // 优先通过原始对象 obj 寻找之前创建的代理对象，如果找到了，直接返回已有的代理对象
  const existionProxy = reactiveMap.get(obj)
  if (existionProxy) return existionProxy

  // 否则，创建新的代理对象
  const proxy = createReactive(obj)
  // 存储到 Map 中，从而避免重复创建
  reactiveMap.set(obj, proxy)
  return proxy
}
function shallowReactive(obj) {
  return createReactive(obj, true)
}

function readonly(obj) {
  return createReactive(obj, false, true)
 }

function shallowReadonly(obj) {
  return createReactive(obj, true /* shallow */, true)
}


let shouldTrack = true
const arrayInstrumentations = {}


['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function(...args) {
    // this 是代理对象，先在代理对象中查找，将结果存储到 res 中
    let res = originMethod.apply(this, args)

    if (res === false || res === -1) {
      // res 为 false 说明没找到，通过 this.raw 拿到原始数组，再去其中查找，并更新 res 值
      res = originMethod.apply(this.raw, args)
    }
    // 返回最终结果
    return res
  }
})
// 重写数组的 push、pop、shift、unshift 以及 splice 方法
['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function(...args) {
    shouldTrack = false
    let res = originMethod.apply(this, args)
    shouldTrack = true
    return res
  }
})


 // 封装 createReactive 函数，接收一个参数 isShallow，代表是否为浅响应，默认为 false，即非浅响应
  // 增加第三个参数 isReadonly，代表是否只读，默认为 false，即非只读
 function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 拦截读取操作
    get(target, key, receiver) {
      console.log('get: ', key)
      // 代理对象可以通过 raw 属性访问原始数据
      if (key === 'raw') {
        return target
      }

        // 如果操作的目标对象是数组，并且 key 存在于 arrayInstrumentations 上，
       // 那么返回定义在 arrayInstrumentations 上的值
       if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }

      // 非只读的时候才需要建立响应联系
      // 添加判断，如果 key 的类型是 symbol，则不进行追踪
      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key)
      }


      const res = Reflect.get(target, key, receiver)

      // 如果是浅响应，则直接返回原始值
      if (isShallow) {
        return res
      }

      

      if (typeof res === 'object' && res !== null) {
        // 如果数据为只读，则调用 readonly 对值进行包装
        return isReadonly ? readonly(res) : reactive(res)
      }
      return res
    },
    set(target, key, newVal, receiver) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }

      // 先获取旧值
      const oldVal = target[key]
  
      // 如果属性不存在，则说明是在添加新的属性，否则是设置已有属性
      const type = Array.isArray(target)
      // 如果代理目标是数组，则检测被设置的索引值是否小于数组长度，
      // 如果是，则视作 SET 操作，否则是 ADD 操作
      ? Number(key) < target.length ? 'SET' : 'ADD'
      : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
  
      // 设置属性值
      const res = Reflect.set(target, key, newVal, receiver);
  
     // target === receiver.raw 说明 receiver 就是 target 的代理对象
      if (target === receiver.raw) {
         // 比较新值与旧值，只有当它们不全等，并且不都是 NaN 的时候才触发响应
        if(oldVal !== newVal && (oldVal === oldVal || newVal === newVal)){
          // 增加第四个参数，即触发响应的新值
          trigger(target, key, type, newVal)
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
      // 如果操作目标 target 是数组，则使用 length 属性作为 key 并建立响应联系
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
    deleteProperty(target, key) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }
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
  })}


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

  // 当操作类型为 ADD 并且目标对象是数组时，应该取出并执行那些与 length 属性相关联的副作用函数
  if (type === 'ADD' && Array.isArray(target)) {
    // 取出与 length 相关联的副作用函数
    const lengthEffects = depsMap.get('length')
    // 将这些副作用函数添加到 effectsToRun 中，待执行
    lengthEffects && lengthEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }


   // 如果操作目标是数组，并且修改了数组的 length 属性
   if (Array.isArray(target) && key === 'length') {
    // 对于索引大于或等于新的 length 值的元素，
    // 需要把所有相关联的副作用函数取出并添加到 effectsToRun 中待执行
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
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

// 在get 拦截函数内调用 track函数追踪变化
function track(target, key) {
  // 当禁止追踪时，直接返回
  if (!activeEffect || !shouldTrack) return

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