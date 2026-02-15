import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {cn} from '../../lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(({className, ...props}, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('ui-dialog-overlay', className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef(({className, children, ...props}, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn('ui-dialog-content', className)}
      {...props}>
      {children}
      <DialogPrimitive.Close className="ui-dialog-close" aria-label="Close">
        <X size={16} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({className, ...props}) => (
  <div className={cn('ui-dialog-header', className)} {...props} />
);

const DialogFooter = ({className, ...props}) => (
  <div className={cn('ui-dialog-footer', className)} {...props} />
);

const DialogTitle = React.forwardRef(({className, ...props}, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('ui-dialog-title', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(({className, ...props}, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('ui-dialog-description', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
};
