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

export function allocateProportionally(totalCents, weights) {
    if (!Number.isInteger(totalCents) || totalCents < 0) {
        throw new TypeError('totalCents deve ser um inteiro não negativo.');
    }
    if (!Array.isArray(weights) || weights.length === 0 || weights.some(weight => !Number.isInteger(weight) || weight < 0)) {
        throw new TypeError('weights deve conter inteiros não negativos.');
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) return weights.map(() => 0);

    const exact = weights.map(weight => (totalCents * weight) / totalWeight);
    const result = exact.map(Math.floor);
    let remaining = totalCents - result.reduce((sum, value) => sum + value, 0);

    exact
        .map((value, index) => ({ index, fraction: value - result[index] }))
        .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
        .forEach(({ index }) => {
            if (remaining > 0) {
                result[index] += 1;
                remaining -= 1;
            }
        });

    return result;
}

/**
 * Parses Brazilian or plain decimal currency text into integer cents.
 * Returns null for empty/invalid input so callers can distinguish it from zero.
 */
export function parseMoneyToCents(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.round(value * 100) : null;
    }
    if (typeof value !== 'string') return null;

    const raw = value.trim();
    if (!raw) return null;

    let normalized = raw
        .replace(/R\$\s*/gi, '')
        .replace(/\s/g, '');

    const hasComma = normalized.includes(',');
    const hasDot = normalized.includes('.');

    if (hasComma && hasDot) {
        // Brazilian format: 1.234,56
        normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
        // Brazilian decimal format: 1234,56
        normalized = normalized.replace(',', '.');
    } else if (hasDot) {
        const dotParts = normalized.split('.');
        const lastPart = dotParts[dotParts.length - 1];
        // Multiple dots or a three-digit suffix are treated as thousands separators.
        if (dotParts.length > 2 || lastPart.length === 3) {
            normalized = normalized.replace(/\./g, '');
        }
    }

    if (!/^[+-]?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(normalized)) {
        return null;
    }

    const number = Number(normalized);
    return Number.isFinite(number) ? Math.round(number * 100) : null;
}

/**
 * Adds calendar months without allowing an invalid day to overflow into the next month.
 * Example: 31/01 + 1 month = 28/02 (or 29/02 in a leap year).
 */
export function addMonthsClamped(inputDate, months) {
    const source = inputDate instanceof Date ? new Date(inputDate.getTime()) : new Date(inputDate);
    if (Number.isNaN(source.getTime())) throw new TypeError('Data inválida.');
    if (!Number.isInteger(months)) throw new TypeError('months deve ser um inteiro.');

    const originalDay = source.getDate();
    const result = new Date(source.getTime());
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(originalDay, lastDay));
    return result;
}
