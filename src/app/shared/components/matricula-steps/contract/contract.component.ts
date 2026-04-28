import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import {
  EnrollmentContractData,
  SignedContractUpload,
  CONTRACT_ACCEPTED_FORMATS,
  CONTRACT_MAX_SIZE_MB,
} from '@core/models/ui/enrollment-contract.model';

@Component({
  selector: 'app-contract-step',
  standalone: true,
  imports: [DatePipe, IconComponent, AsyncBtnComponent],
  templateUrl: './contract.component.html',
  styleUrl: './contract.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractComponent {
  data = input.required<EnrollmentContractData>();
  loading = input<boolean>(false);
  stepNumber = input<number>(5);
  /** Modo matrícula pública: solo muestra el contrato para leer/descargar y aceptar con checkbox. Sin upload. */
  isPublic = input<boolean>(false);
  dataChange = output<EnrollmentContractData>();
  generateContract = output<void>();
  next = output<void>();
  back = output<void>();

  readonly _termsAccepted = signal<boolean>(false);
  readonly canProceed = computed(() =>
    this.isPublic() ? this._termsAccepted() : this.data().canAdvance,
  );

  readonly acceptedFormats = CONTRACT_ACCEPTED_FORMATS;
  readonly maxSizeMb = CONTRACT_MAX_SIZE_MB;

  readonly uploadError = signal<string | null>(null);

  private static readonly ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ContractComponent.ALLOWED_EXTENSIONS.has(ext)) {
      this.uploadError.set(`Formato no permitido. Usa: ${this.acceptedFormats}`);
      input.value = '';
      return;
    }

    if (file.size > this.maxSizeMb * 1024 * 1024) {
      this.uploadError.set(`El archivo supera el tamaño máximo de ${this.maxSizeMb} MB.`);
      input.value = '';
      return;
    }

    this.uploadError.set(null);
    const upload: SignedContractUpload = {
      status: 'uploaded',
      file,
      fileName: file.name,
      fileSize: file.size,
      errorMessage: null,
    };
    this.dataChange.emit({ ...this.data(), signedContract: upload, canAdvance: true });
  }

  clearUpload(): void {
    this.dataChange.emit({ ...this.data(), signedContract: null, canAdvance: false });
  }

  onGenerateContract(): void {
    this.generateContract.emit();
  }

  onNext(): void {
    this.next.emit();
  }

  onBack(): void {
    this.back.emit();
  }
}
