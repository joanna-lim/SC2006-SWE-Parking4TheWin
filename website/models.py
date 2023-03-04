from . import db
from flask_login import UserMixin
import math

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    password = db.Column(db.String(150))
    user_type = db.Column(db.String(50))
    # for drivers
    email = db.Column(db.String(150), unique=True)
    first_name = db.Column(db.String(150))
    vehicles = db.relationship('Vehicle')
    # for companies
    company_name = db.Column(db.String(150))
    uen = db.Column(db.String(150), unique=True)

class Vehicle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150))
    car_plate = db.Column(db.String(150))
    coe_expiry = db.Column(db.Date)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))

class Reward(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reward_title = db.Column(db.String(150))
    reward_expiry = db.Column(db.Date)
    reward_details = db.Column(db.String(10000))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    company = db.relationship('User', backref='company')

class CarPark(db.Model):
    car_park_no = db.Column(db.String, primary_key=True)
    address = db.Column(db.String(150))
    x_coord = db.Column(db.Float)
    y_coord = db.Column(db.Float)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    car_park_type = db.Column(db.String(150))
    type_of_parking_system = db.Column(db.String(150))
    short_term_parking = db.Column(db.String(150))
    free_parking = db.Column(db.String(150))
    night_parking = db.Column(db.Boolean)
    car_park_decks = db.Column(db.Integer)
    gantry_height = db.Column(db.Float)
    car_park_basement = db.Column(db.Boolean)
    total_lots = db.Column(db.Integer)
    lots_available = db.Column(db.Integer)
    lot_type = db.Column(db.String(1))
    lot_info_last_updated = db.Column(db.String(150))