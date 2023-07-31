 // 封装一个 ref 函数
 function ref(val) {
  // 在 ref 函数内部创建包裹对象
  const wrapper = {
    value: val
  }
     // 使用 Object.defineProperty 在 wrapper 对象上定义一个不可枚举的属性 __v_isRef，并且值为 true
     Object.defineProperty(wrapper, '__v_isRef', {
      value: true
    })

    
  // 将包裹对象变成响应式数据
  return reactive(wrapper)
}

function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key]

    },
    // 允许设置值
    set value(val) {
    obj[key] = val
  }
    
  }

  // 定义 __v_isRef 属性
  Object.defineProperty(wrapper, '__v_isRef', {value: true})

  return wrapper
}

function toRefs(obj) {
  const ret = {}
  // 使用 for...in 循环遍历对象
  for (const key in obj) {
    // 逐个调用 toRef 完成转换
    ret[key] = toRef(obj, key)
  }
  return ret
}

function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      // 自动脱 ref 实现：如果读取的值是 ref，则返回它的 value 属性值
      return value.__v_isRef ? value.value : value
    },
    set(target, key, newValue, receiver) {
      // 通过 target 读取真实值
      const value = target[key]
   // 如果值是 Ref，则设置其对应的 value 属性值
    if (value.__v_isRef) {
      value.value = newValue
      return true
    }
    return Reflect.set(target, key, newValue, receiver)
  }
  })
}
