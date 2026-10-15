import { TestBed } from '@angular/core/testing';
import { ConfirmModalService } from './confirm-modal.service';

describe('ConfirmModalService', () => {
  let service: ConfirmModalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmModalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with modal closed and no config', () => {
    expect(service.isOpen()).toBe(false);
    expect(service.config()).toBeNull();
  });

  it('confirm() should open the modal with the provided config', () => {
    service.confirm({ title: 'Eliminar', message: '¿Estás seguro?' });
    expect(service.isOpen()).toBe(true);
    expect(service.config()?.title).toBe('Eliminar');
    expect(service.config()?.message).toBe('¿Estás seguro?');
  });

  it('confirm() should apply default labels when not provided', () => {
    service.confirm({ title: 'T', message: 'M' });
    expect(service.config()?.confirmLabel).toBe('Aceptar');
    expect(service.config()?.cancelLabel).toBe('Cancelar');
    expect(service.config()?.severity).toBe('secondary');
  });

  it('confirm() should use provided custom labels', () => {
    service.confirm({
      title: 'T',
      message: 'M',
      confirmLabel: 'Sí, borrar',
      cancelLabel: 'No',
      severity: 'danger',
    });
    expect(service.config()?.confirmLabel).toBe('Sí, borrar');
    expect(service.config()?.cancelLabel).toBe('No');
    expect(service.config()?.severity).toBe('danger');
  });

  it('hotfix-062-b: el mensaje va como texto salvo que la llamada pida allowHtml', () => {
    service.confirm({ title: 'T', message: '<b>x</b>' });
    expect(service.config()?.allowHtml).toBe(false);

    service.confirm({ title: 'T', message: '<strong>x</strong>', allowHtml: true });
    expect(service.config()?.allowHtml).toBe(true);
  });

  it('accept() should resolve the promise with true and close the modal', async () => {
    const result = service.confirm({ title: 'T', message: 'M' });
    service.accept();
    expect(await result).toBe(true);
    expect(service.isOpen()).toBe(false);
    expect(service.config()).toBeNull();
  });

  it('cancel() should resolve the promise with false and close the modal', async () => {
    const result = service.confirm({ title: 'T', message: 'M' });
    service.cancel();
    expect(await result).toBe(false);
    expect(service.isOpen()).toBe(false);
    expect(service.config()).toBeNull();
  });

  // ── spec 0010-i: confirmación con motivo obligatorio ──────────────────────
  describe('confirmWithReason', () => {
    const cfg = {
      title: 'Alumno con deuda',
      message: 'Debe $180.000',
      reason: { label: 'Motivo', minLength: 5 },
    };

    it('abre con el campo de motivo vacío y no deja aceptar sin motivo suficiente', async () => {
      const result = service.confirmWithReason(cfg);
      expect(service.config()?.reason?.label).toBe('Motivo');
      expect(service.reasonValid()).toBe(false);

      service.setReason('abc');
      service.accept(); // ignorado: motivo muy corto
      expect(service.isOpen()).toBe(true);

      service.setReason('  Paga el viernes  ');
      expect(service.reasonValid()).toBe(true);
      service.accept();
      expect(await result).toBe('Paga el viernes');
      expect(service.isOpen()).toBe(false);
    });

    it('cancelar resuelve null y limpia el motivo', async () => {
      const result = service.confirmWithReason(cfg);
      service.setReason('Paga el viernes');
      service.cancel();
      expect(await result).toBeNull();
      expect(service.reason()).toBe('');
    });

    it('confirm() normal no exige motivo', async () => {
      const result = service.confirm({ title: 'T', message: 'M' });
      expect(service.reasonValid()).toBe(true);
      service.accept();
      expect(await result).toBe(true);
    });
  });
});
