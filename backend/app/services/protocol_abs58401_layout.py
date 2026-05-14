"""
Карта ячеек шаблона protocol_abs_58401_template.xlsx (лист «АБС»).

Сверено с заполненным примером № 1972-М7 (формат .xls): структура совпадает с .xlsx,
номера строк — как в Excel (1-based).

Дальнейший шаг: заполнять эти адреса из моделей Request / Sample / Client / Test
и из JSON полей карточки испытания (bulk_density, max_density, air_voids, binder_content,
grain_composition).
"""

SHEET_ABS = "АБС"

# --- Шапка протокола ---
# В шаблоне U3 = «№ », номер дописывают обычно в V3 (в примере: «№ 01972-М7»).
CELL_PROTOCOL_NUMBER = "V3"
# U4 = «от », дата протокола — в V4 (в примере: «31.05.2024»).
CELL_PROTOCOL_DATE = "V4"

# --- Общие сведения: подписи в колонке A, значения — колонка I (9) ---
# Excel-строки совпадают с шаблоном в «Протоколы LIMS».
GENERAL_VALUE_COL = 9  # I
ROW_CUSTOMER = 11  # Заказчик испытания → Client.name
ROW_CONTACT = 12  # Контактные данные* → email / телефон
ROW_MANUFACTURER = 13  # Производитель смеси*
ROW_SAMPLE_SOURCE = 14  # Проба поступила от
ROW_TEST_OBJECT = 15  # Объект испытаний* → Sample.material_name + ГОСТ
ROW_CONSTRUCTION_OBJECT = 16  # Наименование объекта строительства* → Request / поле заявки
ROW_SAMPLING_PLACE = 17  # Место отбора → Sample.sampling_location
ROW_MIX_RELEASE_DATE = 18  # Дата выпуска смеси (при необходимости отдельное поле в пробе)
ROW_REGISTRATION_DATE = 19  # Дата регистрации → Sample.registration_date
ROW_TEST_DATES = 20  # Дата испытания → из карточки Test.tested_at или диапазон
ROW_MIX_PURPOSE = 21  # Назначение смеси*
ROW_MIX_TYPE = 22  # Тип смеси* → Test.material_type / марка
ROW_BINDER_GRADE = 23  # Марка вяжущего*
ROW_MIX_NUMBER = 24  # Номер состава*
ROW_TRAFFIC_CONDITIONS = 25  # Условия движения АК

# --- Физико-механические показатели (строки 28–31): ---
# Колонка K — НД (в шаблоне уже заполнена).
# O — результат испытания; R — норма из ГОСТ (частично в шаблоне);
# W — показатель по утверждённому рецепту (из карточки / рецепта).
ROW_BULK_DENSITY = 28
ROW_MAX_DENSITY = 29
ROW_AIR_VOIDS = 30
ROW_BINDER_CONTENT = 31
COL_RESULT = "O"
COL_RECIPE_VALUE = "W"

# --- Зерновой состав: размеры сит в L34:X34, доли в L35:X35 и L36:X36 ---
ROW_SIEVE_SIZES = 34  # заголовки мм
ROW_GRAIN_ACTUAL = 35  # проход, % (факт)
ROW_GRAIN_RECIPE = 36  # по рецепту, %
FIRST_SIEVE_COL = 12  # L
LAST_SIEVE_COL = 24  # X

# --- Заключение и исполнитель ---
# Текст заключения в примере начинается с колонки D строки 43.
CELL_CONCLUSION_TEXT = "D43"
# ФИО исполнителя в примере — колонка U, строка с блоком «Испытания провел» (шаблон: около U48).
CELL_EXECUTOR_NAME = "U48"
