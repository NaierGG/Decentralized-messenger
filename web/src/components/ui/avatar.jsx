import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import {cn} from '../../lib/utils';

const Avatar = React.forwardRef(({className, ...props}, ref) => (
  <AvatarPrimitive.Root ref={ref} className={cn('ui-avatar', className)} {...props} />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef(({className, ...props}, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('ui-avatar-image', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef(({className, ...props}, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn('ui-avatar-fallback', className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export {Avatar, AvatarImage, AvatarFallback};
