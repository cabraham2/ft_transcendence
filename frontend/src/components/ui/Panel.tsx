import { type ReactNode } from 'react';

type PanelProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, children, className }: PanelProps) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {title ? <h3 className="panel-title">{title}</h3> : null}
      {children}
    </section>
  );
}
