const Teleport = {
  __isTeleport: true,
  process(n1, n2, container, anchor, internals) {
    // 通过 internals 参数取得渲染器的内部方法
    const { patch } = internals;
    // 如果旧 VNode n1 不存在，则是全新的挂载，否则执行更新
    if (!n1) {
      // 挂载
      // 获取容器，即挂载点
      const target =
        typeof n2.props.to === "string"
          ? document.querySelector(n2.props.to)
          : n2.props.to;
      // 将 n2.children 渲染到指定挂载点即可
      n2.children.forEach((c) => patch(null, c, target, anchor));
    } else {
      // 更新
      patchChildren(n1, n2, container);

      // 如果新旧 to 参数的值不同，则需要对内容进行移动
      if (n2.props.to !== n1.props.to) {
        // 获取新的容器
        const newTarget =
          typeof n2.props.to === "string"
            ? document.querySelector(n2.props.to)
            : n2.props.to;
        // 移动到新的容器
        n2.children.forEach((c) => move(c, newTarget));
      }
    }
  },
};

function patch(n1, n2, container, anchor) {
  if (n1 && n1.type !== n2.type) {
    unmount(n1);
    n1 = null;
  }

  const { type } = n2;

  if (typeof type === "string") {
    // 省略部分代码
  } else if (type === Text) {
    // 省略部分代码
  } else if (type === Fragment) {
    // 省略部分代码
  } else if (typeof type === "object" && type.__isTeleport) {
    // 组件选项中如果存在 __isTeleport 标识，则它是 Teleport 组件，
    // 调用 Teleport 组件选项中的 process 函数将控制权交接出去
    // 传递给 process 函数的第五个参数是渲染器的一些内部方法
    type.process(n1, n2, container, anchor, {
      patch,
      patchChildren,
      unmount,
      // 用来移动被 Teleport 的内容
      move(vnode, container, anchor) {
        insert(
          vnode.component
            ? vnode.component.subTree.el // 移动一个组件
            : vnode.el, // 移动普通元素
          container,
          anchor
        );
      },
    });
  } else if (typeof type === "object" || typeof type === "function") {
    // 省略部分代码
  }
}
