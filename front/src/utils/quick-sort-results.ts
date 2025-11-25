import type { ApiResponse } from "@/App"

export const quickSort = (arr: ApiResponse[], low: number, high: number, ascending: boolean): void => {
    if (low < high) {
      const pi = partition(arr, low, high, ascending)
      quickSort(arr, low, pi - 1, ascending)
      quickSort(arr, pi + 1, high, ascending)
    }
  }

  const partition = (arr: ApiResponse[], low: number, high: number, ascending: boolean): number => {
    const pivot = arr[high].midpoint.reverse?.locality?.toLowerCase() || ''
    let i = low - 1

    for (let j = low; j < high; j++) {
      const currentName = arr[j].midpoint.reverse?.locality?.toLowerCase() || ''
      const shouldSwap = ascending ? currentName <= pivot : currentName >= pivot

      if (shouldSwap) {
        i++
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
    }

    ;[arr[i + 1], arr[high]] = [arr[high], arr[i + 1]]
    return i + 1
  }