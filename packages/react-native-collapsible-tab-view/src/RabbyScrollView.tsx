import React from 'react'
import { ScrollView as RNGHScrollView } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import {
  useAfterMountEffect,
  useChainCallback,
  useCollapsibleStyle,
  useScrollHandlerY,
  useSharedAnimatedRef,
  useTabNameContext,
  useTabsContext,
  useUpdateScrollViewContentSize,
} from './hooks'
import type { ScrollHandlerProps } from './RabbyHooks'

type RNGHScrollViewProps = React.ComponentProps<typeof RNGHScrollView>
const AnimatedRNGHScrollView =
  Animated.createAnimatedComponent<RNGHScrollViewProps>(RNGHScrollView)

type FinalScrollViewProps = RNGHScrollViewProps
type FinalScrollViewType = RNGHScrollView

const ScrollViewMemo = React.memo(
  React.forwardRef<
    FinalScrollViewType,
    React.PropsWithChildren<FinalScrollViewProps>
  >((props, passRef) => {
    return <AnimatedRNGHScrollView ref={passRef} {...props} />
  })
)

export type RabbyScrollViewProps = React.PropsWithChildren<
  Omit<FinalScrollViewProps, 'onScroll'>
> &
  ScrollHandlerProps

function RabbyScrollViewImpl(
  {
    contentContainerStyle,
    style,
    onContentSizeChange,
    children,
    refreshControl,
    onScroll,
    onAnimatedScrollBeginDrag,
    onAnimatedScrollEndDrag,
    onAnimatedScrollMomentumBegin,
    onAnimatedScrollMomentumEnd,
    scrollableEnabled,
    ...rest
  }: RabbyScrollViewProps,
  passRef: React.Ref<FinalScrollViewType>
) {
  const name = useTabNameContext()
  const innerRef = useSharedAnimatedRef<any>(passRef as any)
  const { setRef, contentInset } = useTabsContext()
  const {
    style: _style,
    contentContainerStyle: _contentContainerStyle,
    progressViewOffset,
  } = useCollapsibleStyle()
  const { scrollHandler, enable } = useScrollHandlerY(name, {
    onScroll,
    onAnimatedScrollBeginDrag,
    onAnimatedScrollEndDrag,
    onAnimatedScrollMomentumBegin,
    onAnimatedScrollMomentumEnd,
    scrollableEnabled,
  })
  const onLayout = useAfterMountEffect(rest.onLayout, () => {
    'worklet'
    enable(true)
  })

  React.useEffect(() => {
    setRef(name, innerRef as any)
  }, [name, innerRef, setRef])

  const scrollContentSizeChange = useUpdateScrollViewContentSize({ name })

  const scrollContentSizeChangeHandlers = useChainCallback(
    React.useMemo(
      () => [scrollContentSizeChange, onContentSizeChange],
      [onContentSizeChange, scrollContentSizeChange]
    )
  )

  const memoRefreshControl = React.useMemo(
    () =>
      refreshControl &&
      React.cloneElement(refreshControl, {
        progressViewOffset,
        ...refreshControl.props,
      }),
    [progressViewOffset, refreshControl]
  )

  const memoContentInset = React.useMemo(
    () => ({ top: contentInset }),
    [contentInset]
  )

  const memoContentOffset = React.useMemo(
    () => ({ x: 0, y: -contentInset }),
    [contentInset]
  )

  const memoContentContainerStyle = React.useMemo(
    () => [_contentContainerStyle, contentContainerStyle as any],
    [_contentContainerStyle, contentContainerStyle]
  )
  const memoStyle = React.useMemo(() => [_style, style], [_style, style])

  return (
    <ScrollViewMemo
      {...rest}
      onLayout={onLayout}
      ref={innerRef}
      bouncesZoom={false}
      style={memoStyle}
      contentContainerStyle={memoContentContainerStyle}
      onScroll={scrollHandler}
      onContentSizeChange={scrollContentSizeChangeHandlers}
      scrollEventThrottle={16}
      contentInset={memoContentInset}
      contentOffset={memoContentOffset}
      automaticallyAdjustContentInsets={false}
      refreshControl={memoRefreshControl}
      onMomentumScrollEnd={() => {}}>
      {children}
    </ScrollViewMemo>
  )
}

export const RabbyScrollView = React.forwardRef(RabbyScrollViewImpl)
