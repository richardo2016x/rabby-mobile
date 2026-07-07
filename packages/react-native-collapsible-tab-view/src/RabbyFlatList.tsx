import React from 'react'
import { FlatList as RNGHFlatList } from 'react-native-gesture-handler'
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

type RNGHFlatListProps<T> = React.ComponentProps<typeof RNGHFlatList<T>>
const AnimatedRNGHFlatList =
  Animated.createAnimatedComponent<RNGHFlatListProps<any>>(RNGHFlatList)

type FinalProps<T> = RNGHFlatListProps<T>
type FinalType<T> = RNGHFlatList<T>

const FlatListMemo = React.memo(
  React.forwardRef<FinalType<unknown>, React.PropsWithChildren<FinalProps<unknown>>>(
    (props, passRef) => {
      return <AnimatedRNGHFlatList ref={passRef} {...props} />
    }
  )
)

function RabbyFlatListImpl<R>(
  {
    contentContainerStyle,
    style,
    onContentSizeChange,
    refreshControl,
    ...rest
  }: Omit<FinalProps<R>, 'onScroll'>,
  passRef: React.Ref<FinalType<R>>
): React.ReactElement {
  const name = useTabNameContext()
  const { setRef, contentInset } = useTabsContext()
  const innerRef = useSharedAnimatedRef<any>(passRef as any)

  const { scrollHandler, enable } = useScrollHandlerY(name)
  const onLayout = useAfterMountEffect(rest.onLayout, () => {
    'worklet'
    enable(true)
  })

  const {
    style: _style,
    contentContainerStyle: _contentContainerStyle,
    progressViewOffset,
  } = useCollapsibleStyle()

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
    // @ts-expect-error typescript cannot preserve the generic item type through memoized RNGH animated component
    <FlatListMemo
      {...rest}
      onLayout={onLayout}
      ref={innerRef}
      bouncesZoom={false}
      style={memoStyle}
      contentContainerStyle={memoContentContainerStyle}
      progressViewOffset={progressViewOffset}
      onScroll={scrollHandler}
      onContentSizeChange={scrollContentSizeChangeHandlers}
      scrollEventThrottle={16}
      contentInset={memoContentInset}
      contentOffset={memoContentOffset}
      automaticallyAdjustContentInsets={false}
      refreshControl={memoRefreshControl}
      onMomentumScrollEnd={() => {}}
    />
  )
}

export const RabbyFlatList = React.forwardRef(RabbyFlatListImpl) as <T>(
  props: Omit<FinalProps<T>, 'onScroll'> & { ref?: React.Ref<FinalType<T>> }
) => React.ReactElement
