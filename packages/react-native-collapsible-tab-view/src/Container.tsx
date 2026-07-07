import React from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import PagerView, {
  type PageScrollStateChangedNativeEvent,
} from 'react-native-pager-view'
import Animated, {
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
  useFrameCallback,
} from 'react-native-reanimated'

import { Context, TabNameContext } from './Context'
import { Lazy } from './Lazy'
import { MaterialTabBar, TABBAR_HEIGHT } from './MaterialTabBar'
import { Tab } from './Tab'
import { IS_IOS, ONE_FRAME_MS, scrollToImpl } from './helpers'
import {
  useAnimatedDynamicRefs,
  useContainerRef,
  usePageScrollHandler,
  useTabProps,
  useLayoutHeight,
} from './hooks'
import {
  CollapsibleProps,
  CollapsibleRef,
  ContextType,
  IndexChangeEventData,
  TabName,
} from './types'

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView)

type PagerSelection = {
  index: number
  transitionId: number
}

/**
 * Basic usage looks like this:
 *
 * ```tsx
 * import { Tabs } from @rabby-wallet/react-native-collapsible-tab-view
 *
 * const Example = () => {
 *   return (
 *     <Tabs.Container renderHeader={MyHeader}>
 *       <Tabs.Tab name="A">
 *         <ScreenA />
 *       </Tabs.Tab>
 *       <Tabs.Tab name="B">
 *         <ScreenB />
 *       </Tabs.Tab>
 *     </Tabs.Container>
 *   )
 * }
 * ```
 */
export const Container = React.memo(
  React.forwardRef<CollapsibleRef, CollapsibleProps>(
    (
      {
        initialTabName,
        headerHeight: initialHeaderHeight,
        minHeaderHeight = 0,
        tabBarHeight: initialTabBarHeight = TABBAR_HEIGHT,
        revealHeaderOnScroll = false,
        snapThreshold,
        children,
        renderHeader,
        renderTabBar = (props) => <MaterialTabBar {...props} />,
        headerContainerStyle,
        cancelTranslation,
        containerStyle,
        lazy,
        lazyPreloadDistance = 0,
        cancelLazyFadeIn,
        pagerProps,
        onIndexChange,
        onTabChange,
        width: customWidth,
        allowHeaderOverscroll,
      },
      ref
    ) => {
      const containerRef = useContainerRef()

      const [tabProps, tabNamesArray] = useTabProps(children, Tab)

      const [refMap, setRef] = useAnimatedDynamicRefs()

      const windowWidth = useWindowDimensions().width
      const width = customWidth ?? windowWidth

      const [containerHeight, getContainerLayoutHeight] = useLayoutHeight()

      const [tabBarHeight, getTabBarHeight] =
        useLayoutHeight(initialTabBarHeight)

      const [headerHeight, getHeaderHeight] = useLayoutHeight(
        !renderHeader ? 0 : initialHeaderHeight
      )
      const initialIndex = React.useMemo(
        () =>
          initialTabName
            ? tabNamesArray.findIndex((n) => n === initialTabName)
            : 0,
        [initialTabName, tabNamesArray]
      )

      const contentInset = React.useMemo(() => {
        if (allowHeaderOverscroll) return 0

        // necessary for the refresh control on iOS to be positioned underneath the header
        // this also adjusts the scroll bars to clamp underneath the header area
        return IS_IOS ? (headerHeight || 0) + (tabBarHeight || 0) : 0
      }, [headerHeight, tabBarHeight, allowHeaderOverscroll])

      const snappingTo: ContextType['snappingTo'] = useSharedValue(0)
      const offset: ContextType['offset'] = useSharedValue(0)
      const accScrollY: ContextType['accScrollY'] = useSharedValue(0)
      const oldAccScrollY: ContextType['oldAccScrollY'] = useSharedValue(0)
      const accDiffClamp: ContextType['accDiffClamp'] = useSharedValue(0)
      const scrollYCurrent: ContextType['scrollYCurrent'] = useSharedValue(0)
      const scrollY: ContextType['scrollY'] = useSharedValue(
        Object.fromEntries(tabNamesArray.map((n) => [n, 0]))
      )

      const contentHeights: ContextType['contentHeights'] = useSharedValue(
        tabNamesArray.map(() => 0)
      )

      const tabNames: ContextType['tabNames'] = useDerivedValue<TabName[]>(
        () => tabNamesArray,
        [tabNamesArray]
      )
      const index: ContextType['index'] = useSharedValue(initialIndex)

      const focusedTab: ContextType['focusedTab'] =
        useDerivedValue<TabName>(() => {
          return tabNames.value[index.value]
        }, [tabNames])
      const calculateNextOffset = useSharedValue(initialIndex)
      const headerScrollDistance: ContextType['headerScrollDistance'] =
        useDerivedValue(() => {
          return headerHeight !== undefined ? headerHeight - minHeaderHeight : 0
        }, [headerHeight, minHeaderHeight])

      const indexDecimal: ContextType['indexDecimal'] = useSharedValue(
        index.value
      )
      const visualFocusedTab: ContextType['visualFocusedTab'] =
        useDerivedValue<TabName>(() => {
          const names = tabNames.value
          if (!names.length) {
            return focusedTab.value
          }

          const visualIndex = Math.min(
            Math.max(Math.round(indexDecimal.value), 0),
            names.length - 1
          )
          return names[visualIndex] ?? focusedTab.value
        }, [focusedTab, tabNames])
      const pagerIsIdle: ContextType['pagerIsIdle'] = useSharedValue(true)
      const committedIndexRef = React.useRef(initialIndex)
      const commandedIndexRef = React.useRef<number | null>(null)
      const transitionIdRef = React.useRef(0)
      const pendingSelectedIndexRef = React.useRef<PagerSelection | null>(null)
      const idleCommitFrameRef = React.useRef<number | null>(null)
      const pagerScrollStateRef =
        React.useRef<
          PageScrollStateChangedNativeEvent['nativeEvent']['pageScrollState']
        >('idle')

      const afterRender = useSharedValue(0)
      React.useEffect(() => {
        afterRender.value = withDelay(
          ONE_FRAME_MS * 5,
          withTiming(1, { duration: 0 })
        )
      }, [afterRender, tabNamesArray])

      const resyncTabScroll = () => {
        'worklet'
        if (!pagerIsIdle.value) return

        for (const name of tabNamesArray) {
          scrollToImpl(
            refMap[name],
            0,
            scrollYCurrent.value - contentInset,
            false
          )
        }
      }

      // the purpose of this is to scroll to the proper position if dynamic tabs are changing
      useAnimatedReaction(
        () => {
          return afterRender.value === 1
        },
        (trigger) => {
          if (trigger) {
            afterRender.value = 0
            resyncTabScroll()
          }
        },
        [tabNamesArray, refMap, afterRender, contentInset]
      )

      const propagateTabChange = React.useCallback(
        (change: IndexChangeEventData<TabName>) => {
          onTabChange?.(change)
          onIndexChange?.(change.index)
        },
        [onIndexChange, onTabChange]
      )

      const syncCurrentTabScrollPosition = () => {
        'worklet'
        if (!pagerIsIdle.value) return

        const name = tabNamesArray[index.value]
        scrollToImpl(
          refMap[name],
          0,
          scrollYCurrent.value - contentInset,
          false
        )
      }

      /*
       * We run syncCurrentTabScrollPosition in every frame after the index
       * changes for about 1500ms because the Lists can be late to accept the
       * scrollTo event we send. This fixes the issue of the scroll position
       * jumping when the user changes tab.
       * */
      const toggleSyncScrollFrame = (toggle: boolean) => {
        if (toggle && pagerScrollStateRef.current !== 'idle') return
        syncScrollFrame.setActive(toggle)
      }
      const cancelIdleCommitFrame = React.useCallback(() => {
        if (idleCommitFrameRef.current === null) return

        cancelAnimationFrame(idleCommitFrameRef.current)
        idleCommitFrameRef.current = null
      }, [])
      const syncScrollFrame = useFrameCallback(({ timeSinceFirstFrame }) => {
        if (!pagerIsIdle.value) {
          runOnJS(toggleSyncScrollFrame)(false)
          return
        }

        syncCurrentTabScrollPosition()
        if (timeSinceFirstFrame > 1500) {
          runOnJS(toggleSyncScrollFrame)(false)
        }
      }, false)

      useAnimatedReaction(
        () => {
          return calculateNextOffset.value
        },
        (i) => {
          if (i !== index.value) {
            offset.value =
              scrollY.value[tabNames.value[index.value]] -
              scrollY.value[tabNames.value[i]] +
              offset.value
            runOnJS(propagateTabChange)({
              prevIndex: index.value,
              index: i,
              prevTabName: tabNames.value[index.value],
              tabName: tabNames.value[i],
            })
            index.value = i
            if (
              typeof scrollY.value[tabNames.value[index.value]] === 'number'
            ) {
              scrollYCurrent.value =
                scrollY.value[tabNames.value[index.value]] || 0
            }
            runOnJS(toggleSyncScrollFrame)(true)
          }
        },
        []
      )

      useAnimatedReaction(
        () => headerHeight,
        (_current, prev) => {
          if (prev === undefined) {
            // sync scroll if we started with undefined header height
            resyncTabScroll()
          }
        }
      )

      const headerTranslateY = useDerivedValue(() => {
        return revealHeaderOnScroll
          ? -accDiffClamp.value
          : -Math.min(scrollYCurrent.value, headerScrollDistance.value)
      }, [revealHeaderOnScroll])

      const stylez = useAnimatedStyle(() => {
        return {
          transform: [
            {
              translateY: headerTranslateY.value,
            },
          ],
        }
      }, [revealHeaderOnScroll])

      const onTabPress = React.useCallback(
        (name: TabName) => {
          const i = tabNames.value.findIndex((n) => n === name)
          if (i < 0) return

          if (
            i === committedIndexRef.current &&
            pagerScrollStateRef.current === 'idle'
          ) {
            const ref = refMap[name]
            runOnUI(scrollToImpl)(
              ref,
              0,
              headerScrollDistance.value - contentInset,
              true
            )
          } else {
            transitionIdRef.current += 1
            pagerIsIdle.value = false
            toggleSyncScrollFrame(false)
            cancelIdleCommitFrame()
            commandedIndexRef.current = i
            pendingSelectedIndexRef.current = null
            containerRef.current?.setPage(i)
          }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [containerRef, refMap, contentInset]
      )

      const clampPagerIndex = React.useCallback(
        (rawIndex: number) => {
          const maxIndex = Math.max(0, tabNamesArray.length - 1)
          return Math.min(Math.max(Math.round(rawIndex), 0), maxIndex)
        },
        [tabNamesArray.length]
      )

      const commitPagerIndex = React.useCallback(
        (rawIndex: number) => {
          const nextIndex = clampPagerIndex(rawIndex)
          committedIndexRef.current = nextIndex
          indexDecimal.value = nextIndex
          calculateNextOffset.value = nextIndex
          return nextIndex
        },
        [calculateNextOffset, clampPagerIndex, indexDecimal]
      )

      const commitPendingPagerIndex = React.useCallback(
        (expectedTransitionId?: number) => {
          if (pagerScrollStateRef.current !== 'idle') return

          const pendingSelection = pendingSelectedIndexRef.current
          if (
            pendingSelection &&
            expectedTransitionId !== undefined &&
            pendingSelection.transitionId !== expectedTransitionId
          ) {
            return
          }

          const visualIndex = clampPagerIndex(indexDecimal.value)
          const targetIndex = pendingSelection?.index ?? visualIndex
          const commandedIndex = commandedIndexRef.current
          const selectedLooksStale =
            pendingSelection !== null &&
            commandedIndex === null &&
            visualIndex !== pendingSelection.index

          commitPagerIndex(selectedLooksStale ? visualIndex : targetIndex)
          commandedIndexRef.current = null
          pendingSelectedIndexRef.current = null
        },
        [clampPagerIndex, commitPagerIndex, indexDecimal]
      )

      const schedulePendingPagerIndexCommit = React.useCallback(
        (expectedTransitionId?: number) => {
          cancelIdleCommitFrame()
          idleCommitFrameRef.current = requestAnimationFrame(() => {
            idleCommitFrameRef.current = null
            commitPendingPagerIndex(expectedTransitionId)
          })
        },
        [cancelIdleCommitFrame, commitPendingPagerIndex]
      )

      const handlePageSelected = React.useCallback<
        NonNullable<NonNullable<typeof pagerProps>['onPageSelected']>
      >(
        (event) => {
          pagerProps?.onPageSelected?.(event)
          const selectedIndex = clampPagerIndex(event.nativeEvent.position)
          const commandedIndex = commandedIndexRef.current

          if (pagerScrollStateRef.current === 'dragging') {
            return
          }

          if (commandedIndex !== null && selectedIndex !== commandedIndex) {
            return
          }

          const transitionId = transitionIdRef.current
          pendingSelectedIndexRef.current = {
            index: selectedIndex,
            transitionId,
          }
          if (pagerScrollStateRef.current === 'idle') {
            schedulePendingPagerIndexCommit(transitionId)
          }
        },
        [clampPagerIndex, pagerProps, schedulePendingPagerIndexCommit]
      )

      const handlePageScrollStateChanged = React.useCallback<
        NonNullable<NonNullable<typeof pagerProps>['onPageScrollStateChanged']>
      >(
        (event) => {
          pagerProps?.onPageScrollStateChanged?.(event)
          const state = event.nativeEvent.pageScrollState
          pagerScrollStateRef.current = state
          pagerIsIdle.value = state === 'idle'

          if (state === 'dragging') {
            transitionIdRef.current += 1
            toggleSyncScrollFrame(false)
            cancelIdleCommitFrame()
            commandedIndexRef.current = null
            pendingSelectedIndexRef.current = null
            return
          }

          if (state === 'settling') {
            toggleSyncScrollFrame(false)
            cancelIdleCommitFrame()
            return
          }

          if (state === 'idle') {
            schedulePendingPagerIndexCommit()
          }
        },
        [
          cancelIdleCommitFrame,
          pagerIsIdle,
          pagerProps,
          schedulePendingPagerIndexCommit,
        ]
      )

      useAnimatedReaction(
        () => tabNamesArray.length,
        (tabLength) => {
          if (index.value >= tabLength) {
            runOnJS(onTabPress)(tabNamesArray[tabLength - 1])
          }
        }
      )

      const pageScrollHandler = usePageScrollHandler({
        onPageScroll: (e) => {
          'worklet'
          indexDecimal.value = e.position + e.offset
        },
      })

      React.useImperativeHandle(
        ref,
        () => ({
          setIndex: (index) => {
            const name = tabNames.value[index]
            onTabPress(name)
            return true
          },
          settleToIndex: (index) => {
            const nextIndex = clampPagerIndex(index)
            transitionIdRef.current += 1
            pagerIsIdle.value = false
            commandedIndexRef.current = nextIndex
            pendingSelectedIndexRef.current = {
              index: nextIndex,
              transitionId: transitionIdRef.current,
            }
            toggleSyncScrollFrame(false)
            cancelIdleCommitFrame()
            const pager = containerRef.current as
              | (typeof containerRef.current & {
                  setPageWithoutAnimation?: (index: number) => void
                })
              | null
            if (pager?.setPageWithoutAnimation) {
              pager.setPageWithoutAnimation(nextIndex)
            } else {
              pager?.setPage(nextIndex)
            }
            return true
          },
          jumpToTab: (name) => {
            onTabPress(name)
            return true
          },
          getFocusedTab: () => {
            return tabNames.value[index.value]
          },
          getCurrentIndex: () => {
            return index.value
          },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [onTabPress]
      )

      return (
        <Context.Provider
          value={{
            contentInset,
            tabBarHeight,
            headerHeight,
            refMap,
            tabNames,
            index,
            snapThreshold,
            revealHeaderOnScroll,
            focusedTab,
            visualFocusedTab,
            pagerIsIdle,
            accDiffClamp,
            indexDecimal,
            containerHeight,
            minHeaderHeight,
            scrollYCurrent,
            scrollY,
            setRef,
            headerScrollDistance,
            accScrollY,
            oldAccScrollY,
            offset,
            snappingTo,
            contentHeights,
            headerTranslateY,
            width,
            allowHeaderOverscroll,
          }}
        >
          <Animated.View
            style={[styles.container, { width }, containerStyle]}
            onLayout={getContainerLayoutHeight}
            pointerEvents="box-none"
          >
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.topContainer,
                headerContainerStyle,
                !cancelTranslation && stylez,
              ]}
            >
              <View
                style={[styles.container, styles.headerContainer]}
                onLayout={getHeaderHeight}
                pointerEvents="box-none"
              >
                {renderHeader &&
                  renderHeader({
                    containerRef,
                    index,
                    tabNames: tabNamesArray,
                    focusedTab,
                    indexDecimal,
                    onTabPress,
                    tabProps,
                  })}
              </View>
              <View
                style={[styles.container, styles.tabBarContainer]}
                onLayout={getTabBarHeight}
                pointerEvents="box-none"
              >
                {renderTabBar &&
                  renderTabBar({
                    containerRef,
                    index,
                    tabNames: tabNamesArray,
                    focusedTab,
                    indexDecimal,
                    width,
                    onTabPress,
                    tabProps,
                  })}
              </View>
            </Animated.View>

            <AnimatedPagerView
              ref={containerRef}
              initialPage={initialIndex}
              {...pagerProps}
              onPageScroll={pageScrollHandler}
              onPageSelected={handlePageSelected}
              onPageScrollStateChanged={handlePageScrollStateChanged}
              style={[pagerProps?.style, StyleSheet.absoluteFill]}
            >
              {tabNamesArray.map((tabName, i) => {
                return (
                  <View key={i} style={styles.pageContainer}>
                    <TabNameContext.Provider value={tabName}>
                      <Lazy
                        startMounted={lazy ? undefined : true}
                        cancelLazyFadeIn={!lazy ? true : !!cancelLazyFadeIn}
                        preloadDistance={lazy ? lazyPreloadDistance : 0}
                        indexDecimal={indexDecimal}
                        tabIndex={i}
                        // ensure that we remount the tab if its name changes but the index doesn't
                        key={tabName}
                      >
                        {
                          React.Children.toArray(children)[
                            i
                          ] as React.ReactElement
                        }
                      </Lazy>
                    </TabNameContext.Provider>
                  </View>
                )
              })}
            </AnimatedPagerView>
          </Animated.View>
        </Context.Provider>
      )
    }
  )
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageContainer: {
    height: '100%',
    width: '100%',
  },
  topContainer: {
    position: 'absolute',
    zIndex: 100,
    width: '100%',
    backgroundColor: 'white',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  tabBarContainer: {
    zIndex: 1,
  },
  headerContainer: {
    zIndex: 2,
  },
})
