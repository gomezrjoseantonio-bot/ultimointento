import type { Meta, StoryObj } from '@storybook/react';
import { AtlasButton } from './AtlasButton';

const meta: Meta<typeof AtlasButton> = {
  title: 'ATLAS/AtlasButton',
  component: AtlasButton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AtlasButton>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Botón Primario',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Botón Secundario',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Eliminar',
  },
};

export const Loading: Story = {
  args: {
    variant: 'primary',
    loading: true,
    children: 'Guardando...',
  },
};

export const Small: Story = {
  args: {
    variant: 'primary',
    size: 'sm',
    children: 'Pequeño',
  },
};

export const Large: Story = {
  args: {
    variant: 'primary',
    size: 'lg',
    children: 'Grande',
  },
};
