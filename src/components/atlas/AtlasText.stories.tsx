import type { Meta, StoryObj } from '@storybook/react';
import { AtlasText } from './AtlasText';

const meta: Meta<typeof AtlasText> = {
  title: 'ATLAS/AtlasText',
  component: AtlasText,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AtlasText>;

export const Caption: Story = {
  args: {
    variant: 'caption',
    children: 'Texto caption (14px)',
  },
};

export const Body: Story = {
  args: {
    variant: 'body',
    children: 'Texto body (16px)',
  },
};

export const BodyStrong: Story = {
  args: {
    variant: 'body-strong',
    children: 'Texto body-strong (16px semibold)',
  },
};

export const Subtitle: Story = {
  args: {
    variant: 'subtitle',
    children: 'Texto subtitle (18px medium)',
  },
};

export const Kpi: Story = {
  args: {
    variant: 'kpi',
    children: '1.234,56 €',
  },
};

export const KpiLarge: Story = {
  args: {
    variant: 'kpi-large',
    children: '98.765,43 €',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'body',
    color: 'secondary',
    children: 'Texto secundario en gris',
  },
};

export const Success: Story = {
  args: {
    variant: 'body',
    color: 'success',
    children: 'Texto de éxito en verde',
  },
};
