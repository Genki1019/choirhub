import { vi } from "vitest";
import { fireEvent } from "@testing-library/react";

// jsdomはPointer Capture APIを実装していないため、dnd-kitのPointerSensorが
// 参照できるようにno-opのポリフィルを当てる。各テストのbeforeEachで呼ぶ
export function mockPointerCapture() {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
}

function mockRect(el: Element, rect: { x: number; y: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      toJSON() {
        return this;
      },
    }) as DOMRect;
}

// dnd-kitは`useSortable`のref（[data-dnd-row]）で計測するため、
// ドラッグハンドル自身ではなく最寄りの行コンテナのrectをモックする
function measuredRow(el: Element): Element {
  return el.closest("[data-dnd-row]") ?? el;
}

export function dragAndDrop(source: Element, target: Element) {
  mockRect(measuredRow(source), { x: 0, y: 0, width: 44, height: 44 });
  mockRect(measuredRow(target), { x: 300, y: 0, width: 44, height: 44 });

  fireEvent.pointerDown(source, {
    pointerId: 1,
    clientX: 22,
    clientY: 22,
    button: 0,
    isPrimary: true,
  });
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 322, clientY: 22, isPrimary: true });
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 322, clientY: 22, isPrimary: true });
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 322, clientY: 22, isPrimary: true });
}
