/**
 * Определение типа загружаемого CSV по заголовкам (import.service.detectType)
 * Позитивные сценарии: файлы пайплайна распознаются. Ошибочные: неизвестный файл не принимается.
 */
import { detectType } from '@services/import.service';

describe('detectType', () => {
  describe('позитивные сценарии', () => {
    it('распознаёт справочник станций по колонкам station_id, station_name, road_type', () => {
      const headers = ['АЗС', 'station_id', 'station_name', 'road_type', 'road_level', 'total_pumps'];

      expect(detectType(headers)).toBe('stations');
    });

    it('распознаёт продажи и цены по колонкам sales_AI92 и price_AI92', () => {
      const headers = ['№ п/п', 'Идентификатор АЗС', 'sales_AI92', 'price_AI92', 'total_fuel_sales'];

      expect(detectType(headers)).toBe('prices');
    });

    it('распознаёт погоду по station_name и temperature_C', () => {
      const headers = ['station_name', 'date', 'temperature_C', 'humidity_%'];

      expect(detectType(headers)).toBe('weather');
    });
  });

  describe('обработка ошибок', () => {
    it('возвращает null для неизвестного файла, чтобы загрузка отклонилась', () => {
      expect(detectType(['foo', 'bar', 'baz'])).toBeNull();
    });

    it('не путает станции с ценами: справочник без sales_AI92 не считается ценами', () => {
      const headers = ['station_id', 'station_name', 'road_type'];

      expect(detectType(headers)).not.toBe('prices');
    });

    it('пустой список заголовков не распознаётся', () => {
      expect(detectType([])).toBeNull();
    });
  });
});
