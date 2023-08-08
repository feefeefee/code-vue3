function createRenderer(options) {
  // 通过 options 得到操作 DOM 的 API
  const { createElement, insert, setElementText } = options;

  // 在这个作用域内定义的函数都可以访问那些 API
  function mountElement(vnode, container) {
    // ...
  }

  function patch(n1, n2, container) {
    // ...
  }

  function render(vnode, container) {
    if (vnode) {
      patch(container._vnode, vnode, container);
    } else {
      if (container._vnode) {
        // 调用 unmount 函数卸载 vnode
        unmount(container._vnode);
      }
    }
    container._vnode = vnode;
  }

  return {
    render,
  };
}

// 在创建 renderer 时传入配置项
const renderer = createRenderer({
  // 用于创建元素
  createElement(tag) {
    console.log(`创建元素 ${tag}`);
    return { tag };
  },
  // 用于设置元素的文本节点
  setElementText(el, text) {
    console.log(`设置 ${JSON.stringify(el)} 的文本内容：${text}`);
    el.textContent = text;
  },
  // 用于在给定的 parent 下添加指定元素
  insert(el, parent, anchor = null) {
    console.log(`将 ${JSON.stringify(el)} 添加到 ${JSON.stringify(parent)} 下`);
    parent.children = el;
  },
  createText(text) {
    return document.createTextNode(text);
  },
  setText(el, text) {
    el.nodeValue = text;
  },
  // 将属性设置相关操作封装到 patchProps 函数中，并作为渲染器选项传递
  patchProps(el, key, prevValue, nextValue) {
    // 匹配以 on 开头的属性，视其为事件
    if (/^on/.test(key)) {
      // 获取为该元素伪造的事件处理函数 invoker
      // 定义 el._vei 为一个对象，存在事件名称到事件处理函数的映射
      const invokers = el._vei || (el._vei = {});
      //根据事件名称获取 invoker
      let invoker = invokers[key];

      // 根据属性名称得到对应的事件名称，例如 onClick ---> click
      const name = key.slice(2).toLowerCase();

      if (nextValue) {
        if (!invoker) {
          // 如果没有 invoker，则将一个伪造的 invoker 缓存到 el._vei 中
          // vei 是 vue event invoker 的首字母缩写
          // 将事件处理函数缓存到 el._vei[key] 下，避免覆盖
          invoker = el._vei[key] = (e) => {
            // e.timeStamp 是事件发生的时间
            // 如果事件发生的时间早于事件处理函数绑定的时间，则不执行事件处理函数
            if (e.timeStamp < invoker.attached) return;

            // 如果 invoker.value 是数组，则遍历它并逐个调用事件处理函数
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach((fn) => fn(e));
            } else {
              // 否则直接作为函数调用
              // 当伪造的事件处理函数执行时，会执行真正的事件处理函数
              invoker.value(e);
            }
          };
          // 将真正的事件处理函数赋值给 invoker.value
          invoker.value = nextValue;
          // 添加 invoker.attached 属性，存储事件处理函数被绑定的时间
          invoker.attached = performance.now();
          // 绑定 invoker 作为事件处理函数
          el.addEventListener(name, invoker);
        } else {
          // 如果 invoker 存在，意味着更新，并且只需要更新 invoker.value 的值即可
          invoker.value = nextValue;
        }
      } else if (invoker) {
        // 移除上一次绑定的事件处理函数
        // 新的事件绑定函数不存在，且之前绑定的 invoker 存在，则移除绑定
        el.removeEventListener(name, invoker);
      }
    } else if (key === "class") {
      // 对 class 进行特殊处理
      el.className = nextValue || "";
    } else if (shouldSetAsProps(el, key, nextValue)) {
      // 使用 shouldSetAsProps 函数判断是否应该作为 DOM Properties 设置
      // 获取该 DOM Properties 的类型
      const type = typeof el[key];
      // 如果是布尔类型，并且 value 是空字符串，则将值矫正为 true
      if (type === "boolean" && nextValue === "") {
        el[key] = true;
      } else {
        el[key] = nextValue;
      }
    } else {
      // 如果要设置的属性没有对应的 DOM Properties，则使用 setAttribute 函数设置属性
      el.setAttribute(key, nextValue);
    }
  },
});

function shouldSetAsProps(el, key, value) {
  // 特殊处理
  if (key === "form" && el.tagName === "INPUT") return false;
  // 兜底， 用 in 操作符判断 key 是否存在对应的 DOM Properties
  return key in el;
}

function mountElement(vnode, container) {
  // 调用 createElement 函数创建元素
  // 让 vnode.el 引用真实 DOM 元素
  const el = (vnode.el = createElement(vnode.type));
  // 处理子节点，如果子节点是字符串，代表元素具有文本节点
  if (typeof vnode.children === "string") {
    // 调用 setElementText 设置元素的文本节点
    setElementText(el, vnode.children);
  } else if (Array.isArray(vnode.children)) {
    // 如果 children 是数组，则遍历每一个子节点，并调用 patch 函数挂载它们
    vnode.children.forEach((child) => {
      patch(null, child, el);
    });
  }

  // 如果 vnode.props 存在才处理它
  if (vnode.props) {
    // 遍历 vnode.props
    for (const key in vnode.props) {
      // 调用 patchProps 函数即可
      patchProps(el, key, null, vnode.props[key]);
    }
  }

  // 调用 insert 函数将元素插入到容器内
  insert(el, container);
}

function unmount(vnode) {
  // 在卸载时，如果卸载的 vnode 类型为 Fragment，则需要卸载其 children
  if (vnode.type === Fragment) {
    vnode.children.forEach((c) => unmount(c));
    return;
  }
  // 根据 vnode 获取要卸载的真实 DOM 元素
  // 获取 el 的父元素
  const parent = vnode.el.parentNode;
  if (parent) {
    // 调用 removeChild 移除元素
    if (parent) parent.removeChild(el);
  }
}
function patchChildren(n1, n2, container) {
  // 判断新子节点的类型是否是文本节点
  if (typeof n2.children === "string") {
    // 旧子节点的类型有三种可能：没有子节点、文本子节点以及一组子节点
    // 只有当旧子节点为一组子节点时，才需要逐个卸载，其他情况下什么都不需要做
    if (Array.isArray(n1.children)) {
      n1.children.forEach((c) => unmount(c));
    }
    // 最后将新的文本节点内容设置给容器元素
    setElementText(container, n2.children);
  } else if (Array.isArray(n2.children)) {
    // 说明新子节点是一组子节点

    // 判断旧子节点是否也是一组子节点
    if (Array.isArray(n1.children)) {
      // 代码运行到这里，则说明新旧子节点都是一组子节点，这里涉及核心的 Diff 算法
      // 将旧的一组子节点全部卸载
      n1.children.forEach((c) => unmount(c));
      // 再将新的一组子节点全部挂载到容器中
      n2.children.forEach((c) => patch(null, c, container));
    } else {
      // 此时：
      // 旧子节点要么是文本子节点，要么不存在
      // 但无论哪种情况，我们都只需要将容器清空，然后将新的一组子节点逐个挂载
      setElementText(container, "");
      n2.children.forEach((c) => patch(null, c, container));
    }
  } else {
    // 代码运行到这里，说明新子节点不存在
    // 旧子节点是一组子节点，只需逐个卸载即可
    if (Array.isArray(n1.children)) {
      n1.children.forEach((c) => unmount(c));
    } else if (typeof n1.children === "string") {
      // 旧子节点是文本子节点，清空内容即可
      setElementText(container, "");
    }
    // 如果也没有旧子节点，那么什么都不需要做
  }
}
function patchElement(n1, n2) {
  const el = (n2.el = n1.el);
  const oldProps = n1.props;
  const newProps = n2.props;
  // 第一步：更新 props
  for (const key in newProps) {
    if (newProps[key] !== oldProps[key]) {
      patchProps(el, key, oldProps[key], newProps[key]);
    }
  }
  for (const key in oldProps) {
    if (!(key in newProps)) {
      patchProps(el, key, oldProps[key], null);
    }
  }

  // 第二步：更新 children
  patchChildren(n1, n2, el);
}
function patch(n1, n2, container) {
  // 如果 n1 存在，则对比 n1 和 n2 的类型
  if (n1 && n1.type !== n2.type) {
    // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
    unmount(n1);
    n1 = null;
  }

  // 代码运行到这里，证明 n1 和 n2 所描述的内容相同
  const { type } = n2;
  // 如果 n2.type 的值是字符串类型，则它描述的是普通标签元素
  if (typeof type === "string") {
    if (!n1) {
      mountElement(n2, container);
    } else {
      patchElement(n1, n2);
    }
  } else if (typeof type === "object") {
    // 如果 n2.type 的值的类型是对象，则它描述的是组件
  } else if (type === Text) {
    // 如果新 vnode 的类型是 Text，则说明该 vnode 描述的是文本节点
    // 如果没有旧节点，则进行挂载
    if (!n1) {
      // 使用 createTextNode 创建文本节点
      // 调用 createText 函数创建文本节点
      const el = (n2.el = createText(n2.children));
      // 将文本节点插入到容器中
      insert(el, container);
    } else {
      // 如果旧 vnode 存在，只需要使用新文本节点的文本内容更新旧文本节点即可
      const el = (n2.el = n1.el);
      if (n2.children !== n1.children) {
        // 调用 setText 函数更新文本节点的内容
        setText(el, n2.children);
      }
    }
  } else if (type === Fragment) {
    // 处理 Fragment 类型的 vnode
    if (!n1) {
      // 如果旧 vnode 不存在，则只需要将 Fragment 的 children 逐个挂载即可
      n2.children.forEach((c) => patch(null, c, container));
    } else {
      // 如果旧 vnode 存在，则只需要更新 Fragment 的 children 即可
      patchChildren(n1, n2, container);
    }
  } else if (typeof type === "object") {
    // vnode.type 的值是选项对象，作为组件来处理
    if (!n1) {
      // 挂载组件
      mountComponent(n2, container, anchor);
    } else {
      // 更新组件
      patchComponent(n1, n2, anchor);
    }
  } else if (type === "xxx") {
    // 处理其他类型的 vnode
  }

  // 如果 n1 不存在，意味着挂载，则调用 mountElement 函数完成挂载
  if (!n1) {
    mountElement(n2, container);
  } else {
    // n1 存在，意味着打补丁，暂时省略
  }
}

 // 全局变量，存储当前正在被初始化的组件实例
 let currentInstance = null
 // 该方法接收组件实例作为参数，并将该实例设置为 currentInstance
 function setCurrentInstance(instance) {
   currentInstance = instance
 }

 function onMounted(fn) {
  if (currentInstance) {
    // 将生命周期函数添加到 instance.mounted 数组中
    currentInstance.mounted.push(fn)
  } else {
    console.error('onMounted 函数只能在 setup 中调用')
  }
}
function mountComponent(vnode, container, anchor) {
  // 通过 vnode 获取组件的选项对象，即 vnode.type
  const componentOptions = vnode.type;
  // 获取组件的渲染函数 render
  // 从组件选项对象中取得组件的生命周期函数
  // 从组件选项对象中取出 props 定义，即 propsOption
  const {
    render,
    data,
    props: propsOption,
    beforeCreate,
    created,
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
  } = componentOptions;

  // 在这里调用 beforeCreate 钩子
  beforeCreate && beforeCreate();
  // 调用 data 函数得到原始数据，并调用 reactive 函数将其包装为响应式数据
  const state = reactive(data());

  // 调用 resolveProps 函数解析出最终的 props 数据与 attrs 数据
  const [props, attrs] = resolveProps(propsOption, vnode.props);

  // 定义组件实例，一个组件实例本质上就是一个对象，它包含与组件有关的状态信息
  const instance = {
    // 组件自身的状态数据，即 data
    state,
    // 将解析出的 props 数据包装为 shallowReactive 并定义到组件实例上
    props: shallowReactive(props),
    // 一个布尔值，用来表示组件是否已经被挂载，初始值为 false
    isMounted: false,
    // 组件所渲染的内容，即子树（subTree）
    subTree: null,
    // 将插槽添加到组件实例上
    slots,
         // 在组件实例中添加 mounted 数组，用来存储通过 onMounted 函数注册的生命周期钩子函数
         mounted: []
  };

  // 定义 emit 函数，它接收两个参数
  // event: 事件名称
  // payload: 传递给事件处理函数的参数
  function emit(event, ...payload) {
    // 根据约定对事件名称进行处理，例如 change --> onChange
    const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
    // 根据处理后的事件名称去 props 中寻找对应的事件处理函数
    const handler = instance.props[eventName];
    if (handler) {
      // 调用事件处理函数并传递参数
      handler(...payload);
    } else {
      console.error("事件不存在");
    }
  }

  // 直接使用编译好的 vnode.children 对象作为 slots 对象即可
  const slots = vnode.children || {};

  // 将 emit 函数添加到 setupContext 中，用户可以通过 setupContext 取得 emit 函数
  // 将 slots 对象添加到 setupContext 中
  const setupContext = { attrs, emit, slots };
     // 在调用 setup 函数之前，设置当前组件实例
     setCurrentInstance(instance)
  // 调用 setup 函数，将只读版本的 props 作为第一个参数传递，避免用户意外地修改 props 的值，
  // 将 setupContext 作为第二个参数传递
  const setupResult = setup(shallowReadonly(instance.props), setupContext);
     // 在 setup 函数执行完毕之后，重置当前组件实例
     setCurrentInstance(null)
  // setupState 用来存储由 setup 返回的数据
  let setupState = null;
  // 如果 setup 函数的返回值是函数，则将其作为渲染函数
  if (typeof setupResult === "function") {
    // 报告冲突
    if (render) console.error("setup 函数返回渲染函数，render 选项将被忽略");
    // 将 setupResult 作为渲染函数
    render = setupResult;
  } else {
    // 如果 setup 的返回值不是函数，则作为数据状态赋值给 setupState
    setupState = setupResult;
  }

  // 将组件实例设置到 vnode 上，用于后续更新
  vnode.component = instance;

  // 创建渲染上下文对象，本质上是组件实例的代理
  const renderContext = new Proxy(instance, {
    get(t, k, r) {
      // 取得组件自身状态与 props 数据
      const { state, props, slots } = t
      // 当 k 的值为 $slots 时，直接返回组件实例上的 slots
      if (k === '$slots') return slots
      // 先尝试读取自身状态数据
      if (state && k in state) {
        return state[k];
      } else if (k in props) {
        // 如果组件自身没有该数据，则尝试从 props 中读取
        return props[k];
      } else if (setupState && k in setupState) {
        // 渲染上下文需要增加对 setupState 的支持
        return setupState[k];
      } else {
        console.error("不存在");
      }
    },
    set(t, k, v, r) {
      const { state, props } = t;
      if (state && k in state) {
        state[k] = v;
      } else if (k in props) {
        console.warn(`Attempting to mutate prop "${k}". Props are readonly.`);
      } else if (setupState && k in setupState) {
        // 渲染上下文需要增加对 setupState 的支持
        setupState[k] = v;
      } else {
        console.error("不存在");
      }
    },
  });

  // 在这里调用 created 钩子
  created && created.call(renderContext);

  effect(
    () => {
      // 调用 render 函数时，将其 this 设置为 state，
      // 从而 render 函数内部可以通过 this 访问组件自身状态数据
      // 执行渲染函数，获取组件要渲染的内容，即 render 函数返回的虚拟 DOM
      // 调用组件的渲染函数，获得子树
      const subTree = render.call(renderContext, renderContext)

      // 检查组件是否已经被挂载
      if (!instance.isMounted) {
        // 在这里调用 beforeMount 钩子
        beforeMount && beforeMount.call(state);
        // 初次挂载，调用 patch 函数第一个参数传递 null
        // 最后调用 patch 函数来挂载组件所描述的内容，即 subTree
        patch(null, subTree, container, anchor);
        // 重点：将组件实例的 isMounted 设置为 true，这样当更新发生时就不会再次进行挂载操作，
        // 而是会执行更新
        instance.isMounted = true;
        // 在这里调用 mounted 钩子
        mounted && mounted.call(state);
          // 遍历 instance.mounted 数组并逐个执行即可
          instance.mounted && instance.mounted.forEach(hook => hook.call(renderContext))
      } else {
        // 在这里调用 beforeUpdate 钩子
        beforeUpdate && beforeUpdate.call(state);
        // 当 isMounted 为 true 时，说明组件已经被挂载，只需要完成自更新即可，
        // 所以在调用 patch 函数时，第一个参数为组件上一次渲染的子树，
        // 意思是，使用新的子树与上一次渲染的子树进行打补丁操作
        patch(instance.subTree, subTree, container, anchor);
        // 在这里调用 updated 钩子
        updated && updated.call(state);
      }

      // 更新组件实例的子树
      instance.subTree = subTree;
    },
    {
      // 指定该副作用函数的调度器为 queueJob 即可
      scheduler: queueJob,
    }
  );
}

function patchComponent(n1, n2, anchor) {
  // 获取组件实例，即 n1.component，同时让新的组件虚拟节点 n2.component 也指向组件实例
  const instance = (n2.component = n1.component);
  // 获取当前的 props 数据
  const { props } = instance;
  // 调用 hasPropsChanged 检测为子组件传递的 props 是否发生变化，如果没有变化，则不需要更新
  if (hasPropsChanged(n1.props, n2.props)) {
    // 调用 resolveProps 函数重新获取 props 数据
    const [nextProps] = resolveProps(n2.type.props, n2.props);
    // 更新 props
    for (const k in nextProps) {
      props[k] = nextProps[k];
    }
    // 删除不存在的 props
    for (const k in props) {
      if (!(k in nextProps)) delete props[k];
    }
  }
}

function hasPropsChanged(prevProps, nextProps) {
  const nextKeys = Object.keys(nextProps);
  // 如果新旧 props 的数量变了，则说明有变化
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true;
  }
  // 只有
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i];
    // 有不相等的 props，则说明有变化
    if (nextProps[key] !== prevProps[key]) return true;
  }
  return false;
}

// resolveProps 函数用于解析组件 props 和 attrs 数据
function resolveProps(options, propsData) {
  const props = {};
  const attrs = {};
  // 遍历为组件传递的 props 数据
  for (const key in propsData) {
    if (key in options || key.startsWith("on")) {
      // 以字符串 on 开头的 props，无论是否显式地声明，都将其添加到 props 数据中，而不是添加到 attrs 中
      // 如果为组件传递的 props 数据在组件自身的 props 选项中有定义，则将其视为合法的 props
      props[key] = propsData[key];
    } else {
      // 否则将其作为 attrs
      attrs[key] = propsData[key];
    }
  }

  // 最后返回 props 与 attrs 数据
  return [props, attrs];
}
// 任务缓存队列，用一个 Set 数据结构来表示，这样就可以自动对任务进行去重
const queue = new Set();
// 一个标志，代表是否正在刷新任务队列
let isFlushing = false;
// 创建一个立即 resolve 的 Promise 实例
const p = Promise.resolve();

// 调度器的主要函数，用来将一个任务添加到缓冲队列中，并开始刷新队列
function queueJob(job) {
  // 将 job 添加到任务队列 queue 中
  queue.add(job);
  // 如果还没有开始刷新队列，则刷新之
  if (!isFlushing) {
    // 将该标志设置为 true 以避免重复刷新
    isFlushing = true;
    // 在微任务中刷新缓冲队列
    p.then(() => {
      try {
        // 执行任务队列中的任务
        queue.forEach((job) => job());
      } finally {
        // 重置状态
        isFlushing = false;
        queue.clear = 0;
      }
    });
  }
}

