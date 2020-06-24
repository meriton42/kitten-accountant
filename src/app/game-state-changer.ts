export type Update<T> = {[K in keyof T]?: Update<T[K]>}

/**
 * Modifies state by patching in the new property values
 * @returns a function to undo the change
 */
export function apply<S>(state: S, update: Update<S>) {
	// while cloning would be safer than modifying the object in place, 
	// it turned out to be too slow (the state object is huge, and modified states are needed very often)
	const memento = _apply(state, update);
  return () => {
		_apply(state, memento);
	}
}

function _apply(s: Object, update: Object) {
	const memento = {};
	for (const k in update) {
		if (update[k] instanceof Object) {
			memento[k] = _apply(s[k], update[k]);
		} else {
			memento[k] = s[k];
			s[k] = update[k];
		}
	}
	return memento;
}