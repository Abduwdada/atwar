import type { ReactNode } from 'react'

const I = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const Home = () => <I><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></I>
export const Issues = () => <I><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></I>
export const Books = () => <I><path d="M5 4h4v16H5zM10 4h4v16h-4z" /><path d="M15.5 4.5l3.8 1 -3.6 14.5 -3.8 -1" /></I>
export const Plus = () => <I><path d="M12 5v14M5 12h14" /></I>
export const More = () => <I><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></I>
export const Grid = () => <I><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16M15 4v16" /></I>
export const Tree = () => <I><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="M16 5.5C10 6 9 11 8 12M16 18.5C10 18 9 13 8 12" /></I>
export const Compare = () => <I><path d="M7 4v16M17 4v16" /><path d="M3 8l4-4 4 4M13 16l4 4 4-4" /></I>
export const ChevronIn = () => <I><path d="M15 6l-6 6 6 6" /></I>
export const Back = () => <I><path d="M9 6l6 6-6 6" /></I>
export const Search = () => <I><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></I>
export const Trash = () => <I><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></I>
export const Edit = () => <I><path d="M4 20h4L19 9l-4-4L4 16z" /></I>
export const Check = () => <I><path d="M5 12l5 5 9-10" /></I>
export const Download = () => <I><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></I>
export const Upload = () => <I><path d="M12 15V4M7 9l5-5 5 5M5 20h14" /></I>
export const X = () => <I><path d="M6 6l12 12M18 6L6 18" /></I>
