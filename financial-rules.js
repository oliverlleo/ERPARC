export function allocateCents(totalCents, count) {
    if (!Number.isInteger(totalCents) || totalCents < 0) {
        throw new TypeError('totalCents deve ser um inteiro não negativo.');
    }
    if (!Number.isInteger(count) || count <= 0) {
        throw new RangeError('count deve ser um inteiro positivo.');
    }

    const base = Math.floor(totalCents / count);
    const remainder = totalCents % count;
    return Array.from(
        { length: count },
        (_, index) => base + (index < remainder ? 1 : 0)
    );
}

export function classifyOverdueBucket(daysLate) {
    if (!Number.isFinite(daysLate) || daysLate < 0) return null;
    if (daysLate <= 30) return '30';
    if (daysLate <= 60) return '60';
    if (daysLate <= 90) return '90';
    return '91+';
}
