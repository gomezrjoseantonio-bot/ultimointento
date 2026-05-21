import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ChipBtn from '../ChipBtn';

describe('ChipBtn', () => {
  test('click invoca onClick cuando no está disabled', () => {
    const onClick = jest.fn();
    render(<ChipBtn active={false} onClick={onClick}>Larga</ChipBtn>);
    fireEvent.click(screen.getByRole('radio'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('disabled · NO invoca onClick', () => {
    const onClick = jest.fn();
    render(<ChipBtn active={false} disabled onClick={onClick}>Impago</ChipBtn>);
    fireEvent.click(screen.getByRole('radio'));
    expect(onClick).not.toHaveBeenCalled();
  });

  test('renderiza count cuando se pasa', () => {
    render(<ChipBtn active={false} count={5} onClick={() => {}}>Larga</ChipBtn>);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('accesible · role radio + aria-checked refleja active', () => {
    const { rerender } = render(
      <ChipBtn active onClick={() => {}}>X</ChipBtn>,
    );
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'true');

    rerender(<ChipBtn active={false} onClick={() => {}}>X</ChipBtn>);
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'false');
  });
});
