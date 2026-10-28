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
export const Overview = () => <I><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="4" rx="1.5" /><rect x="13" y="10" width="7" height="10" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /></I>
export const Up = () => <I><path d="M6 15l6-6 6 6" /></I>
export const Down = () => <I><path d="M6 9l6 6 6-6" /></I>
export const Settings = () => <I><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></I>
export const Eye = () => <I><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></I>
export const EyeOff = () => <I><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></I>
export const Minus = () => <I><path d="M5 12h14" /></I>
export const Camera = () => <I><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></I>
export const Image = () => <I><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></I>
export const Rotate = () => <I><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" /></I>
