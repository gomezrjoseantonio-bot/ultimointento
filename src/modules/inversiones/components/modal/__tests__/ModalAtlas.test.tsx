// Smoke tests · Modal ATLAS shell · PR 1 T-INVERSIONES-V5
// Cobertura mínima (spec §11.1) · render shell · close al click backdrop · close al Escape.
// Estos tests valen sólo para la shell · los modales concretos (Alta Plan,
// Aportar, etc.) traen sus propios tests en PRs 3-4.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ModalAtlas, { ModalAtlasBody, ModalAtlasForm } from '../ModalAtlas';
import ModalAtlasHeader from '../ModalAtlasHeader';
import ModalAtlasFooter, {
  ModalAtlasButtonGhost,
  ModalAtlasButtonGold,
} from '../ModalAtlasFooter';
import ModalAtlasPreview, {
  ModalAtlasPreviewCardDark,
  ModalAtlasPreviewRow,
} from '../ModalAtlasPreview';

describe('ModalAtlas · shell', () => {
  it('renderiza overlay + modal + children con role="dialog"', () => {
    render(
      <ModalAtlas onClose={() => undefined} ariaLabel="Test modal">
        <ModalAtlasHeader
          icon={<svg data-testid="hdr-icon" />}
          title="Título"
          subtitle="Subtítulo"
          onClose={() => undefined}
        />
        <ModalAtlasBody>
          <ModalAtlasForm>
            <p data-testid="form-content">Form</p>
          </ModalAtlasForm>
          <ModalAtlasPreview header="VISTA PREVIA">
            <p data-testid="prev-content">Preview</p>
          </ModalAtlasPreview>
        </ModalAtlasBody>
        <ModalAtlasFooter
          info={<span>Info</span>}
          actions={
            <>
              <ModalAtlasButtonGhost>Cancelar</ModalAtlasButtonGhost>
              <ModalAtlasButtonGold>Guardar</ModalAtlasButtonGold>
            </>
          }
        />
      </ModalAtlas>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Test modal');
    expect(dialog).toHaveAttribute('data-size', 'default');

    expect(screen.getByText('Título')).toBeInTheDocument();
    expect(screen.getByText('Subtítulo')).toBeInTheDocument();
    expect(screen.getByTestId('form-content')).toBeInTheDocument();
    expect(screen.getByTestId('prev-content')).toBeInTheDocument();
    expect(screen.getByText('VISTA PREVIA')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
    expect(screen.getByText('Guardar')).toBeInTheDocument();
  });

  it('aplica la variante de tamaño "narrow" cuando se le pide', () => {
    render(
      <ModalAtlas onClose={() => undefined} size="narrow" ariaLabel="narrow">
        <p>contenido</p>
      </ModalAtlas>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('data-size', 'narrow');
  });

  it('aplica la variante "noPreview" cuando se le pide', () => {
    render(
      <ModalAtlas onClose={() => undefined} size="noPreview" ariaLabel="nope">
        <p>contenido</p>
      </ModalAtlas>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('data-size', 'noPreview');
  });

  it('llama onClose al click sobre el backdrop (overlay) pero NO sobre el panel', () => {
    const onClose = jest.fn();
    render(
      <ModalAtlas onClose={onClose} ariaLabel="bd">
        <p>contenido</p>
      </ModalAtlas>,
    );

    // Click dentro del panel · NO cierra.
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    // Click sobre el overlay (backdrop) · cierra.
    fireEvent.click(screen.getByTestId('modal-atlas-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama onClose al pulsar la tecla Escape', () => {
    const onClose = jest.fn();
    render(
      <ModalAtlas onClose={onClose} ariaLabel="esc">
        <p>contenido</p>
      </ModalAtlas>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama onClose al click sobre el botón X del header', () => {
    const onClose = jest.fn();
    render(
      <ModalAtlas onClose={onClose} ariaLabel="x">
        <ModalAtlasHeader
          icon={<svg />}
          title="T"
          onClose={onClose}
        />
      </ModalAtlas>,
    );

    fireEvent.click(screen.getByTestId('modal-atlas-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('NO se cierra al pulsar teclas distintas a Escape', () => {
    const onClose = jest.fn();
    render(
      <ModalAtlas onClose={onClose} ariaLabel="enter">
        <p>contenido</p>
      </ModalAtlas>,
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: ' ' });
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('limpia el listener de teclado al desmontarse (no llama onClose tras unmount)', () => {
    const onClose = jest.fn();
    const { unmount } = render(
      <ModalAtlas onClose={onClose} ariaLabel="u">
        <p>contenido</p>
      </ModalAtlas>,
    );
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ModalAtlasPreview · subcomponentes', () => {
  it('CardDark renderiza valor con variante "gold"', () => {
    render(
      <ModalAtlasPreviewCardDark
        label="LÍMITE DEDUCIBLE"
        value="10.000 €"
        valueVariant="gold"
        sub="art. 51.7 LIRPF"
      />,
    );
    expect(screen.getByText('LÍMITE DEDUCIBLE')).toBeInTheDocument();
    expect(screen.getByText('10.000 €')).toBeInTheDocument();
    expect(screen.getByText('art. 51.7 LIRPF')).toBeInTheDocument();
  });

  it('PreviewRow renderiza k y v', () => {
    render(<ModalAtlasPreviewRow k="Tipo" v="PPE" />);
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('PPE')).toBeInTheDocument();
  });
});
