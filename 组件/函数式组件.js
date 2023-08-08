function patch(n1, n2, container, anchor) {
  if (n1 && n1.type !== n2.type) {
    unmount(n1)
    n1 = null
  }

  const { type } = n2

  if (typeof type === 'string') {
    // 省略部分代码
  } else if (type === Text) {
    // 省略部分代码
  } else if (type === Fragment) {
    // 省略部分代码
  } else if (
    // type 是对象 --> 有状态组件
    // type 是函数 --> 函数式组件
    typeof type === 'object' || typeof type === 'function'
  ) {
    // component
    if (!n1) {
      mountComponent(n2, container, anchor)
    } else {
      patchComponent(n1, n2, anchor)
    }
  }
}

function mountComponent(vnode, container, anchor) {
  // 检查是否是函数式组件
  const isFunctional = typeof vnode.type === 'function'

  let componentOptions = vnode.type
  if (isFunctional) {
    // 如果是函数式组件，则将 vnode.type 作为渲染函数，将 vnode.type.props 作为 props 选项定义即可
    componentOptions = {
      render: vnode.type,
      props: vnode.type.props
    }
  }

  // 省略部分代码
}