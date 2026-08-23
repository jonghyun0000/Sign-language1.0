// =============================================================================
// EventBus — 아주 작은 타입 안전 이벤트 emitter
// =============================================================================
// 왜 필요한가?
//   "손 모양을 인식하면 이펙트를 터뜨린다"는 흐름을 만들 때, 인식하는 쪽
//   (EffectGestureDetector)과 그리는 쪽(EffectManager)이 서로를 직접 알 필요가
//   없습니다. 그 사이를 이벤트로 연결하면 각 모듈을 따로 테스트하고,
//   나중에 새 이펙트를 추가할 때도 감지 코드를 건드리지 않아도 됩니다.
//
// 사용 예:
//   const bus = new EventBus<{ hello: { name: string } }>();
//   const off = bus.on('hello', (p) => console.log(p.name));
//   bus.emit('hello', { name: '종현' });
//   off(); // 구독 해제

/** 이벤트 이름 → payload 타입 매핑. */
export type EventMap = Record<string, unknown>;

/** 구독 해제 함수. */
export type Unsubscribe = () => void;

export class EventBus<M extends EventMap> {
  // 이벤트 이름별 리스너 집합. Set을 쓰면 중복 등록과 해제가 간단합니다.
  private listeners = new Map<keyof M, Set<(payload: never) => void>>();

  /** 이벤트를 구독합니다. 반환된 함수를 호출하면 구독이 해제됩니다. */
  on<K extends keyof M>(event: K, handler: (payload: M[K]) => void): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as (payload: never) => void);
    return () => {
      set?.delete(handler as (payload: never) => void);
    };
  }

  /** 한 번만 실행되는 구독. */
  once<K extends keyof M>(event: K, handler: (payload: M[K]) => void): Unsubscribe {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  /** 이벤트를 발행합니다. 리스너가 던진 예외는 다른 리스너를 막지 않습니다. */
  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // 순회 중 구독 해제가 일어나도 안전하도록 복사본을 씁니다.
    for (const handler of Array.from(set)) {
      try {
        (handler as (p: M[K]) => void)(payload);
      } catch (err) {
        console.error(`[EventBus] "${String(event)}" 리스너에서 오류:`, err);
      }
    }
  }

  /** 특정 이벤트(또는 전체)의 리스너를 모두 제거합니다. */
  clear<K extends keyof M>(event?: K): void {
    if (event === undefined) this.listeners.clear();
    else this.listeners.delete(event);
  }
}
