import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 20, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconDownload(props: IconProps) {
  return <Icon {...props}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></Icon>
}

export function IconHistory(props: IconProps) {
  return <Icon {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></Icon>
}

export function IconSettings(props: IconProps) {
  return <Icon {...props}><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.07 14H3v-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.07V3h4v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.93 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></Icon>
}

export function IconRefresh(props: IconProps) {
  return <Icon {...props}><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8" /><path d="M21 3v5h-5" /></Icon>
}

export function IconLink(props: IconProps) {
  return <Icon {...props}><path d="M10.5 13.5a4.5 4.5 0 0 0 6.36.04l2.1-2.1a4.5 4.5 0 1 0-6.36-6.36l-1.2 1.2" /><path d="M13.5 10.5a4.5 4.5 0 0 0-6.36-.04l-2.1 2.1a4.5 4.5 0 1 0 6.36 6.36l1.2-1.2" /></Icon>
}

export function IconClipboard(props: IconProps) {
  return <Icon {...props}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6" /><path d="M9 14h6" /></Icon>
}

export function IconFolder(props: IconProps) {
  return <Icon {...props}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" /></Icon>
}

export function IconFolderOpen(props: IconProps) {
  return <Icon {...props}><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v2" /><path d="M3 7h17.4a1 1 0 0 1 .96 1.27l-2.3 8A2 2 0 0 1 17.13 18H5.5a2 2 0 0 1-1.93-1.47L2.6 9.4A2 2 0 0 1 4.53 7H3Z" /></Icon>
}

export function IconImage(props: IconProps) {
  return <Icon {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.4" /><path d="m21 15-4.5-4.5L6 21" /></Icon>
}

export function IconVideo(props: IconProps) {
  return <Icon {...props}><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 10 5-3v10l-5-3" /></Icon>
}

export function IconCheck(props: IconProps) {
  return <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>
}

export function IconAlert(props: IconProps) {
  return <Icon {...props}><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 4.2 2.7 17.4A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.6L13.7 4.2a2 2 0 0 0-3.4 0Z" /></Icon>
}

export function IconInfo(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></Icon>
}

export function IconX(props: IconProps) {
  return <Icon {...props}><path d="m6 6 12 12" /><path d="M18 6 6 18" /></Icon>
}

export function IconPlay(props: IconProps) {
  return <Icon {...props}><path d="m8 5 11 7-11 7V5Z" /></Icon>
}

export function IconShield(props: IconProps) {
  return <Icon {...props}><path d="M12 3 4.5 6v5.5c0 4.5 3 7.4 7.5 9.5 4.5-2.1 7.5-5 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></Icon>
}

export function IconSparkles(props: IconProps) {
  return <Icon {...props}><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" /><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" /><path d="m5 14 .6 1.9L7.5 16l-1.9.6L5 18.5l-.6-1.9L2.5 16l1.9-.6L5 14Z" /></Icon>
}

export function IconBolt(props: IconProps) {
  return <Icon {...props}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Icon>
}

export function IconInstagram(props: IconProps) {
  return <Icon {...props} strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.3" /><path d="M17.4 6.6h.01" /></Icon>
}

export function IconTrash(props: IconProps) {
  return <Icon {...props}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m6 7 1 14h10l1-14" /><path d="M10 11v6" /><path d="M14 11v6" /></Icon>
}

export function IconWifiOff(props: IconProps) {
  return <Icon {...props}><path d="m3 3 18 18" /><path d="M8.5 8.5A10.5 10.5 0 0 1 21 9" /><path d="M3 9a10.5 10.5 0 0 1 3.1-1.8" /><path d="M6 13a7 7 0 0 1 4.8-1.8" /><path d="M9 17a4 4 0 0 1 5.4-.6" /><path d="M12 21h.01" /></Icon>
}

export function IconClock(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.4 2" /></Icon>
}

export function IconExpand(props: IconProps) {
  return <Icon {...props}><path d="m4 9V5a1 1 0 0 1 1-1h4" /><path d="M20 15v4a1 1 0 0 1-1 1h-4" /><path d="M15 4h4a1 1 0 0 1 1 1v4" /><path d="M9 20H5a1 1 0 0 1-1-1v-4" /></Icon>
}

export function IconFilm(props: IconProps) {
  return <Icon {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14" /><path d="M17 5v14" /><path d="M3 9h4" /><path d="M17 9h4" /><path d="M3 15h4" /><path d="M17 15h4" /></Icon>
}
