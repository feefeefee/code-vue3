/* 
 reactive 与 shallowReactive 的区别，即深响应和浅响应的区别
*/

function reactive(obj) {
  return createReactive(obj)
}
function shallowReactive(obj) {
  return createReactive(obj, true)
}



 // 封装 createReactive 函数，接收一个参数 isShallow，代表是否为浅响应，默认为 false，即非浅响应
 function createReactive(obj, isShallow = false) {
  return new Proxy(obj, {
    // 拦截读取操作
    get(target, key, receiver) {
      // 代理对象可以通过 raw 属性访问原始数据
      if (key === 'raw') {
        return target
      }

      const res = Reflect.get(target, key, receiver)

      track(target, key)

      // 如果是浅响应，则直接返回原始值
      if (isShallow) {
        return res
      }

      if (typeof res === 'object' && res !== null) {
        return reactive(res)
      }

      return res
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
  })}

  