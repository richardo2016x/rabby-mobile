import type { FlashListProps, FlashListRef } from '@shopify/flash-list';
import React from 'react';

import { FlashList } from './FlashList';

type MasonryFlashListProps<T> = FlashListProps<T> & {
  numColumns?: number;
  optimizeItemArrangement?: boolean;
}

export const MasonryFlashList = React.forwardRef(
  function MasonryFlashListImpl<T>(
    props: MasonryFlashListProps<T>,
    ref: React.Ref<FlashListRef<T>>,
  ) {
    return <FlashList {...props} ref={ref} />;
  },
) as <T>(
  props: MasonryFlashListProps<T> & { ref?: React.Ref<FlashListRef<T>> },
) => React.ReactElement;
