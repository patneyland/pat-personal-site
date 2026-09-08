/**
 * How tall the sticky nav is, in px.
 *
 * Measured off Nav.tsx rather than computed: it is one line of small caps in
 * 1.1rem of padding, and it does not change with the viewport. It lives here
 * because three unrelated things need it and none of them owns it. Everything
 * Gary draws has to stay clear of the nav (his thought bubble is painted, so
 * "behind the nav" means "with the nav on top of it", not "scrolled away"),
 * and both /story and the pages he paces solve their bounds against it.
 *
 * If the nav's padding or type size changes, re-measure and change it here.
 * There is deliberately no second copy.
 */
export const NAV_H = 54;
