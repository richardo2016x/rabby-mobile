import React, { useCallback } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  runOnJS,
  withTiming,
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated'

import { ScrollView } from './ScrollView'
import { useScroller, useTabNameContext, useTabsContext } from './hooks'

/**
 * Typically used internally, but if you want to mix lazy and regular screens you can wrap the lazy ones with this component.
 */
export const Lazy: React.FC<{
  /**
   * Whether to cancel the lazy fade in animation. Defaults to false.
   */
  cancelLazyFadeIn?: boolean
  /**
   * How long to wait before mounting the children.
   */
  mountDelayMs?: number
  /**
   * Whether to start mounted. Defaults to true if we are the focused tab.
   */
  startMounted?: boolean
  /**
   * Mount when the pager is close enough to this tab.
   */
  preloadDistance?: number
  indexDecimal?: SharedValue<number>
  tabIndex?: number
  children: React.ReactElement
}> = ({
  children,
  cancelLazyFadeIn,
  startMounted: _startMounted,
  preloadDistance = 0,
  indexDecimal,
  tabIndex,
  mountDelayMs = 50,
}) => {
  const name = useTabNameContext()
  const { visualFocusedTab, refMap } = useTabsContext()

  const canPreload =
    preloadDistance > 0 &&
    indexDecimal !== undefined &&
    typeof tabIndex === 'number'

  /**
   * We start mounted if we are the focused tab, if props.startMounted is true,
   * or if this tab is inside the configured preload range.
   */
  const shouldStartMounted =
    typeof _startMounted === 'boolean'
      ? _startMounted
      : visualFocusedTab.value === name ||
        (canPreload &&
          Math.abs(indexDecimal.value - tabIndex) <= preloadDistance)

  /**
   * We keep track of whether a layout has been triggered
   */
  const didTriggerLayout = useSharedValue(false)

  /**
   * This is used to control when children are mounted
   */
  const [canMount, setCanMount] = React.useState(shouldStartMounted)
  /**
   * Ensure we don't mount after the component has been unmounted
   */
  const isSelfMounted = React.useRef(true)

  let initialOpacity = 1
  if (!cancelLazyFadeIn && !shouldStartMounted) {
    initialOpacity = 0
  }
  const opacity = useSharedValue(initialOpacity)

  React.useEffect(() => {
    return () => {
      isSelfMounted.current = false
    }
  }, [])

  const startMountTimer = React.useCallback(
    (focusedTab: string) => {
      // wait the scene to be at least mountDelay ms focused, before mounting
      setTimeout(() => {
        if (focusedTab === name) {
          if (isSelfMounted.current) setCanMount(true)
        }
      }, mountDelayMs)
    },
    [mountDelayMs, name]
  )

  useAnimatedReaction(
    () => {
      return visualFocusedTab.value === name
    },
    (focused, wasFocused) => {
      if (focused && !wasFocused && !canMount) {
        if (cancelLazyFadeIn) {
          opacity.value = 1
          runOnJS(setCanMount)(true)
        } else {
          runOnJS(startMountTimer)(visualFocusedTab.value)
        }
      }
    },
    [canMount, visualFocusedTab]
  )

  useAnimatedReaction(
    () => {
      if (!canPreload || canMount) return false

      return Math.abs(indexDecimal!.value - tabIndex!) <= preloadDistance
    },
    (shouldPreload, wasPreloading) => {
      if (shouldPreload && !wasPreloading && !canMount) {
        if (cancelLazyFadeIn) {
          opacity.value = 1
        }
        runOnJS(setCanMount)(true)
      }
    },
    [
      canMount,
      canPreload,
      cancelLazyFadeIn,
      indexDecimal,
      preloadDistance,
      tabIndex,
    ]
  )

  const scrollTo = useScroller()

  const ref = name ? refMap[name] : null

  useAnimatedReaction(
    () => {
      return didTriggerLayout.value
    },
    (isMounted, wasMounted) => {
      if (isMounted && !wasMounted) {
        if (!cancelLazyFadeIn && opacity.value !== 1) {
          opacity.value = withTiming(1)
        }
      }
    },
    [ref, cancelLazyFadeIn, name, didTriggerLayout, scrollTo]
  )

  const stylez = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    }
  }, [opacity])

  const onLayout = useCallback(() => {
    didTriggerLayout.value = true
  }, [didTriggerLayout])

  return canMount ? (
    cancelLazyFadeIn ? (
      children
    ) : (
      <Animated.View
        pointerEvents="box-none"
        style={[styles.container, !cancelLazyFadeIn ? stylez : undefined]}
        onLayout={onLayout}
      >
        {children}
      </Animated.View>
    )
  ) : (
    <ScrollView />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
