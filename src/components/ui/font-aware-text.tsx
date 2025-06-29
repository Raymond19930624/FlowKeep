import React, { HTMLAttributes, ReactNode, isValidElement } from 'react';
import { useFontSupport } from '@/hooks/useFontChecker';

type AllowedElements = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'strong' | 'em';

interface FontAwareTextProps extends Omit<HTMLAttributes<HTMLElement>, 'as'> {
  children: ReactNode;
  as?: AllowedElements;
  className?: string;
}

export const FontAwareText: React.FC<FontAwareTextProps> = ({
  children,
  as: Component = 'span',
  className = '',
  ...props
}) => {
  // 確保 children 是字串
  const text = React.useMemo(() => {
    if (typeof children === 'string') return children;
    if (isValidElement(children) && typeof children.props.children === 'string') {
      return children.props.children;
    }
    return '';
  }, [children]);

  const isKiwiMaruSupported = useFontSupport(text);
  
  const fontClass = isKiwiMaruSupported 
    ? 'font-kiwi' 
    : 'font-sans';

  // 使用類型斷言來處理動態組件
  const Element = Component as keyof JSX.IntrinsicElements;

  return (
    <Element 
      className={`${fontClass} ${className}`} 
      data-font-supported={isKiwiMaruSupported}
      {...props as any}
    >
      {children}
    </Element>
  );
};

export default FontAwareText;
