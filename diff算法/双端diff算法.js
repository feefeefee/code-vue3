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

    // 封装 patchKeyedChildren 函数处理两组子节点
    patchKeyedChildren(n1, n2, container);
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
function patchKeyedChildren(n1, n2, container) {
  const oldChildren = n1.children;
  const newChildren = n2.children;
  // 四个索引值
  let oldStartIdx = 0;
  let oldEndIdx = oldChildren.length - 1;
  let newStartIdx = 0;
  let newEndIdx = newChildren.length - 1;
  // 四个索引指向的 vnode 节点
  let oldStartVNode = oldChildren[oldStartIdx];
  let oldEndVNode = oldChildren[oldEndIdx];
  let newStartVNode = newChildren[newStartIdx];
  let newEndVNode = newChildren[newEndIdx];

  while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    // 增加两个判断分支，如果头尾部节点为 undefined，则说明该节点已经被处理过了，直接跳到下一个位置
    if (!oldStartVNode) {
      oldStartVNode = oldChildren[++oldStartIdx];
    } else if (!oldEndVNode) {
      oldEndVNode = oldChildren[--oldEndIdx];
    } else if (oldStartVNode.key === newStartVNode.key) {
      // 步骤一：oldStartVNode 和 newStartVNode 比较
      // 调用 patch 函数在 oldStartVNode 与 newStartVNode 之间打补丁
      patch(oldStartVNode, newStartVNode, container);
      // 更新相关索引，指向下一个位置
      oldStartVNode = oldChildren[++oldStartIdx];
      newStartVNode = newChildren[++newStartIdx];
    } else if (oldEndVNode.key === newEndVNode.key) {
      // 步骤二：oldEndVNode 和 newEndVNode 比较
      // 节点在新的顺序中仍然处于尾部，不需要移动，但仍需打补丁
      patch(oldEndVNode, newEndVNode, container);
      // 更新索引和头尾部节点变量
      oldEndVNode = oldChildren[--oldEndIdx];
      newEndVNode = newChildren[--newEndIdx];
    } else if (oldStartVNode.key === newEndVNode.key) {
      // 步骤三：oldStartVNode 和 newEndVNode 比较
      // 调用 patch 函数在 oldStartVNode 和 newEndVNode 之间打补丁
      patch(oldStartVNode, newEndVNode, container);
      // 将旧的一组子节点的头部节点对应的真实 DOM 节点 oldStartVNode.el 移动到
      // 旧的一组子节点的尾部节点对应的真实 DOM 节点后面
      insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling);
      // 更新相关索引到下一个位置
      oldStartVNode = oldChildren[++oldStartIdx];
      newEndVNode = newChildren[--newEndIdx];
    } else if (oldEndVNode.key === newStartVNode.key) {
      // 步骤四：oldEndVNode 和 newStartVNode 比较
      // 仍然需要调用 patch 函数进行打补丁
      patch(oldEndVNode, newStartVNode, container);
      // 移动 DOM 操作
      // oldEndVNode.el 移动到 oldStartVNode.el 前面
      insert(oldEndVNode.el, container, oldStartVNode.el);

      // 移动 DOM 完成后，更新索引值，指向下一个位置
      oldEndVNode = oldChildren[--oldEndIdx];
      newStartVNode = newChildren[++newStartIdx];
    } else {
      // 遍历旧的一组子节点，试图寻找与 newStartVNode 拥有相同 key 值的节点
      // idxInOld 就是新的一组子节点的头部节点在旧的一组子节点中的索引
      const idxInOld = oldChildren.findIndex(
        (node) => node.key === newStartVNode.key
      );

      // idxInOld 大于 0，说明找到了可复用的节点，并且需要将其对应的真实 DOM 移动到头部
      if (idxInOld > 0) {
        // idxInOld 位置对应的 vnode 就是需要移动的节点
        const vnodeToMove = oldChildren[idxInOld];
        // 不要忘记除移动操作外还应该打补丁
        patch(vnodeToMove, newStartVNode, container);
        // 将 vnodeToMove.el 移动到头部节点 oldStartVNode.el 之前，因此使用后者作为锚点
        insert(vnodeToMove.el, container, oldStartVNode.el);
        // 由于位置 idxInOld 处的节点所对应的真实 DOM 已经移动到了别处，因此将其设置为 undefined
        oldChildren[idxInOld] = undefined;
        // 最后更新 newStartIdx 到下一个位置
        newStartVNode = newChildren[++newStartIdx];
      } else {
        // 将 newStartVNode 作为新节点挂载到头部，使用当前头部节点 oldStartVNode.el 作为锚点
        patch(null, newStartVNode, container, oldStartVNode.el);
      }
      newStartVNode = newChildren[++newStartIdx];
    }
  }

  // 循环结束后检查索引值的情况，
  if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
    // 如果满足条件，则说明有新的节点遗留，需要挂载它们
    for (let i = newStartIdx; i <= newEndIdx; i++) {
      patch(null, newChildren[i], container, oldStartVNode.el);
    }
  } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
    // 移除操作
    for (let i = oldStartIdx; i <= oldEndIdx; i++) {
      unmount(oldChildren[i]);
    }
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
