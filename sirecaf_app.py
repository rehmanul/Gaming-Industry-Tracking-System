import sys
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QTableWidget, QTableWidgetItem,
    QTextEdit, QMessageBox, QComboBox, QDateEdit, QCheckBox,
    QGroupBox, QSplitter, QStatusBar, QMenuBar, QProgressBar
)
from PyQt6.QtCore import Qt, QDate, QTimer, pyqtSignal
from PyQt6.QtGui import QFont, QIcon, QAction
import json
import os
from datetime import datetime
from sirecaf_core import (
    FEMADataManager, Case, Person, Location, EmergencyType,
    Resource, Communication, ReportGenerator
)

class SIRECAFApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.data_manager = FEMADataManager()
        self.current_case = None
        self.init_ui()
        self.load_data()

    def init_ui(self):
        self.setWindowTitle('SIRECAF - Sistema de Registro de Casos FEMA')
        self.setGeometry(100, 100, 1200, 800)

        # Crear barra de menú
        self.create_menu_bar()

        # Widget central
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        # Layout principal
        main_layout = QHBoxLayout(central_widget)

        # Panel izquierdo - Formulario
        self.form_widget = self.create_form_widget()
        main_layout.addWidget(self.form_widget, 1)

        # Panel derecho - Lista y detalles
        right_panel = self.create_right_panel()
        main_layout.addWidget(right_panel, 2)

        # Barra de estado
        self.status_bar = self.statusBar()
        self.status_bar.showMessage('Listo')

        # Barra de progreso (oculta por defecto)
        self.progress_bar = QProgressBar()
        self.status_bar.addPermanentWidget(self.progress_bar)
        self.progress_bar.hide()

    def create_menu_bar(self):
        menubar = self.menuBar()

        # Menú Archivo
        file_menu = menubar.addMenu('Archivo')

        new_action = QAction('Nuevo Caso', self)
        new_action.triggered.connect(self.new_case)
        file_menu.addAction(new_action)

        save_action = QAction('Guardar', self)
        save_action.triggered.connect(self.save_case)
        file_menu.addAction(save_action)

        load_action = QAction('Cargar', self)
        load_action.triggered.connect(self.load_case)
        file_menu.addAction(load_action)

        file_menu.addSeparator()

        exit_action = QAction('Salir', self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        # Menú Reportes
        reports_menu = menubar.addMenu('Reportes')

        generate_report_action = QAction('Generar Reporte', self)
        generate_report_action.triggered.connect(self.generate_report)
        reports_menu.addAction(generate_report_action)

        # Menú Ayuda
        help_menu = menubar.addMenu('Ayuda')

        about_action = QAction('Acerca de', self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)

    def create_form_widget(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)

        # Título
        title_label = QLabel('Registro de Caso FEMA')
        title_label.setFont(QFont('Arial', 16, QFont.Weight.Bold))
        layout.addWidget(title_label)

        # Grupo: Información del Caso
        case_group = QGroupBox('Información del Caso')
        case_layout = QVBoxLayout(case_group)

        # ID del Caso
        id_layout = QHBoxLayout()
        id_layout.addWidget(QLabel('ID del Caso:'))
        self.case_id_edit = QLineEdit()
        self.case_id_edit.setReadOnly(True)
        id_layout.addWidget(self.case_id_edit)
        case_layout.addLayout(id_layout)

        # Fecha
        date_layout = QHBoxLayout()
        date_layout.addWidget(QLabel('Fecha:'))
        self.date_edit = QDateEdit()
        self.date_edit.setDate(QDate.currentDate())
        date_layout.addWidget(self.date_edit)
        case_layout.addLayout(date_layout)

        # Tipo de Emergencia
        emergency_layout = QHBoxLayout()
        emergency_layout.addWidget(QLabel('Tipo de Emergencia:'))
        self.emergency_combo = QComboBox()
        self.emergency_combo.addItems(['Incendio', 'Inundación', 'Terremoto', 'Huracán', 'Otro'])
        emergency_layout.addWidget(self.emergency_combo)
        case_layout.addLayout(emergency_layout)

        # Severidad
        severity_layout = QHBoxLayout()
        severity_layout.addWidget(QLabel('Severidad:'))
        self.severity_combo = QComboBox()
        self.severity_combo.addItems(['Baja', 'Media', 'Alta', 'Crítica'])
        severity_layout.addWidget(self.severity_combo)
        case_layout.addLayout(severity_layout)

        layout.addWidget(case_group)

        # Grupo: Ubicación
        location_group = QGroupBox('Ubicación')
        location_layout = QVBoxLayout(location_group)

        # Dirección
        address_layout = QHBoxLayout()
        address_layout.addWidget(QLabel('Dirección:'))
        self.address_edit = QLineEdit()
        address_layout.addWidget(self.address_edit)
        location_layout.addLayout(address_layout)

        # Ciudad
        city_layout = QHBoxLayout()
        city_layout.addWidget(QLabel('Ciudad:'))
        self.city_edit = QLineEdit()
        city_layout.addWidget(self.city_edit)
        location_layout.addLayout(city_layout)

        # Estado/Provincia
        state_layout = QHBoxLayout()
        state_layout.addWidget(QLabel('Estado:'))
        self.state_edit = QLineEdit()
        state_layout.addWidget(self.state_edit)
        location_layout.addLayout(state_layout)

        # Código Postal
        zip_layout = QHBoxLayout()
        zip_layout.addWidget(QLabel('Código Postal:'))
        self.zip_edit = QLineEdit()
        zip_layout.addWidget(self.zip_edit)
        location_layout.addLayout(zip_layout)

        layout.addWidget(location_group)

        # Grupo: Información de la Persona
        person_group = QGroupBox('Información de la Persona Afectada')
        person_layout = QVBoxLayout(person_group)

        # Nombre
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel('Nombre:'))
        self.name_edit = QLineEdit()
        name_layout.addWidget(self.name_edit)
        person_layout.addLayout(name_layout)

        # Apellido
        lastname_layout = QHBoxLayout()
        lastname_layout.addWidget(QLabel('Apellido:'))
        self.lastname_edit = QLineEdit()
        lastname_layout.addWidget(self.lastname_edit)
        person_layout.addLayout(lastname_layout)

        # Edad
        age_layout = QHBoxLayout()
        age_layout.addWidget(QLabel('Edad:'))
        self.age_edit = QLineEdit()
        age_layout.addWidget(self.age_edit)
        person_layout.addLayout(age_layout)

        # Teléfono
        phone_layout = QHBoxLayout()
        phone_layout.addWidget(QLabel('Teléfono:'))
        self.phone_edit = QLineEdit()
        phone_layout.addWidget(self.phone_edit)
        person_layout.addLayout(phone_layout)

        # Email
        email_layout = QHBoxLayout()
        email_layout.addWidget(QLabel('Email:'))
        self.email_edit = QLineEdit()
        email_layout.addWidget(self.email_edit)
        person_layout.addLayout(email_layout)

        layout.addWidget(person_group)

        # Grupo: Descripción
        description_group = QGroupBox('Descripción del Caso')
        description_layout = QVBoxLayout(description_group)

        self.description_edit = QTextEdit()
        self.description_edit.setPlaceholderText('Describa detalladamente el caso...')
        description_layout.addWidget(self.description_edit)

        layout.addWidget(description_group)

        # Botones
        buttons_layout = QHBoxLayout()

        self.save_button = QPushButton('Guardar Caso')
        self.save_button.clicked.connect(self.save_case)
        buttons_layout.addWidget(self.save_button)

        self.clear_button = QPushButton('Limpiar')
        self.clear_button.clicked.connect(self.clear_form)
        buttons_layout.addWidget(self.clear_button)

        layout.addLayout(buttons_layout)

        return widget

    def create_right_panel(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)

        # Lista de casos
        cases_group = QGroupBox('Casos Registrados')
        cases_layout = QVBoxLayout(cases_group)

        self.cases_table = QTableWidget()
        self.cases_table.setColumnCount(4)
        self.cases_table.setHorizontalHeaderLabels(['ID', 'Fecha', 'Tipo', 'Severidad'])
        self.cases_table.horizontalHeader().setStretchLastSection(True)
        self.cases_table.itemSelectionChanged.connect(self.on_case_selected)
        cases_layout.addWidget(self.cases_table)

        layout.addWidget(cases_group)

        # Detalles del caso
        details_group = QGroupBox('Detalles del Caso')
        details_layout = QVBoxLayout(details_group)

        self.details_text = QTextEdit()
        self.details_text.setReadOnly(True)
        details_layout.addWidget(self.details_text)

        layout.addWidget(details_group)

        return widget

    def new_case(self):
        self.clear_form()
        self.current_case = None
        self.case_id_edit.clear()
        self.status_bar.showMessage('Nuevo caso creado')

    def save_case(self):
        try:
            # Validar campos requeridos
            if not self.name_edit.text() or not self.address_edit.text():
                QMessageBox.warning(self, 'Campos requeridos',
                                  'Por favor complete al menos el nombre y la dirección.')
                return

            # Crear objetos
            location = Location(
                address=self.address_edit.text(),
                city=self.city_edit.text(),
                state=self.state_edit.text(),
                zip_code=self.zip_edit.text()
            )

            person = Person(
                first_name=self.name_edit.text(),
                last_name=self.lastname_edit.text(),
                age=int(self.age_edit.text()) if self.age_edit.text() else None,
                phone=self.phone_edit.text(),
                email=self.email_edit.text()
            )

            emergency_type = EmergencyType(
                type=self.emergency_combo.currentText(),
                severity=self.severity_combo.currentText()
            )

            # Crear o actualizar caso
            if self.current_case:
                self.current_case.location = location
                self.current_case.person = person
                self.current_case.emergency_type = emergency_type
                self.current_case.description = self.description_edit.toPlainText()
                self.current_case.date = self.date_edit.date().toPyDate()
            else:
                self.current_case = Case(
                    location=location,
                    person=person,
                    emergency_type=emergency_type,
                    description=self.description_edit.toPlainText(),
                    date=self.date_edit.date().toPyDate()
                )
                self.data_manager.add_case(self.current_case)

            self.save_data()
            self.update_cases_table()
            self.status_bar.showMessage('Caso guardado exitosamente')

        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Error al guardar el caso: {str(e)}')

    def load_case(self):
        # Implementar carga de caso desde archivo
        pass

    def clear_form(self):
        self.name_edit.clear()
        self.lastname_edit.clear()
        self.age_edit.clear()
        self.phone_edit.clear()
        self.email_edit.clear()
        self.address_edit.clear()
        self.city_edit.clear()
        self.state_edit.clear()
        self.zip_edit.clear()
        self.description_edit.clear()
        self.emergency_combo.setCurrentIndex(0)
        self.severity_combo.setCurrentIndex(0)
        self.date_edit.setDate(QDate.currentDate())

    def on_case_selected(self):
        selected_items = self.cases_table.selectedItems()
        if selected_items:
            case_id = selected_items[0].text()
            case = self.data_manager.get_case_by_id(case_id)
            if case:
                self.current_case = case
                self.load_case_to_form(case)

    def load_case_to_form(self, case):
        self.case_id_edit.setText(case.id)
        self.date_edit.setDate(QDate(case.date.year, case.date.month, case.date.day))
        self.emergency_combo.setCurrentText(case.emergency_type.type)
        self.severity_combo.setCurrentText(case.emergency_type.severity)

        self.address_edit.setText(case.location.address)
        self.city_edit.setText(case.location.city)
        self.state_edit.setText(case.location.state)
        self.zip_edit.setText(case.location.zip_code)

        self.name_edit.setText(case.person.first_name)
        self.lastname_edit.setText(case.person.last_name)
        self.age_edit.setText(str(case.person.age) if case.person.age else '')
        self.phone_edit.setText(case.person.phone)
        self.email_edit.setText(case.person.email)

        self.description_edit.setText(case.description)

        # Mostrar detalles
        details = f"""
Caso ID: {case.id}
Fecha: {case.date.strftime('%Y-%m-%d')}
Tipo: {case.emergency_type.type}
Severidad: {case.emergency_type.severity}

Ubicación:
{case.location.address}
{case.location.city}, {case.location.state} {case.location.zip_code}

Persona Afectada:
{case.person.first_name} {case.person.last_name}
Edad: {case.person.age if case.person.age else 'N/A'}
Teléfono: {case.person.phone}
Email: {case.person.email}

Descripción:
{case.description}
        """
        self.details_text.setText(details.strip())

    def update_cases_table(self):
        self.cases_table.setRowCount(0)
        for case in self.data_manager.cases:
            row_position = self.cases_table.rowCount()
            self.cases_table.insertRow(row_position)

            self.cases_table.setItem(row_position, 0, QTableWidgetItem(case.id))
            self.cases_table.setItem(row_position, 1, QTableWidgetItem(case.date.strftime('%Y-%m-%d')))
            self.cases_table.setItem(row_position, 2, QTableWidgetItem(case.emergency_type.type))
            self.cases_table.setItem(row_position, 3, QTableWidgetItem(case.emergency_type.severity))

    def generate_report(self):
        try:
            report_generator = ReportGenerator(self.data_manager)
            report = report_generator.generate_summary_report()

            # Mostrar reporte en una nueva ventana
            report_window = QWidget()
            report_window.setWindowTitle('Reporte de Casos')
            report_window.setGeometry(200, 200, 600, 400)

            layout = QVBoxLayout(report_window)
            report_text = QTextEdit()
            report_text.setText(report)
            layout.addWidget(report_text)

            report_window.show()

        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Error al generar reporte: {str(e)}')

    def show_about(self):
        QMessageBox.about(self, 'Acerca de SIRECAF',
                         'Sistema de Registro de Casos FEMA\n'
                         'Versión 1.0\n'
                         'Desarrollado con PyQt6')

    def save_data(self):
        try:
            data = {
                'cases': [case.to_dict() for case in self.data_manager.cases]
            }
            with open('sirecaf_data.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Error al guardar datos: {str(e)}')

    def load_data(self):
        try:
            if os.path.exists('sirecaf_data.json'):
                with open('sirecaf_data.json', 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for case_data in data.get('cases', []):
                        case = Case.from_dict(case_data)
                        self.data_manager.add_case(case)
                self.update_cases_table()
        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Error al cargar datos: {str(e)}')

def main():
    app = QApplication(sys.argv)
    app.setStyle('Fusion')

    # Estilo oscuro
    app.setStyleSheet("""
        QMainWindow {
            background-color: #2b2b2b;
            color: #ffffff;
        }
        QWidget {
            background-color: #2b2b2b;
            color: #ffffff;
        }
        QGroupBox {
            font-weight: bold;
            border: 2px solid #555;
            border-radius: 5px;
            margin-top: 1ex;
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px 0 5px;
        }
        QLineEdit, QTextEdit, QComboBox, QDateEdit {
            background-color: #404040;
            color<read_file>
<path>.env</path>
</read_file>
