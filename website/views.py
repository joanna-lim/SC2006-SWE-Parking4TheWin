from flask import Blueprint, render_template, request, flash, jsonify
from flask_login import login_required, current_user
from . import db
from .auth import role_required
from functools import wraps
from .models import *
from datetime import datetime
import json
import os
import math

MAPBOX_SECRET_KEY=os.getenv("MAPBOX_SECRET_KEY")
import math

def svy21_to_wgs84(easting, northing):
    # SVY21 projection parameters
    a = 6378137.0
    f = 1 / 298.257223563
    o_lat = 1.36666666667
    o_lng = 103.833333333
    k = 1.0
    
    # Convert to Cartesian coordinates
    e = easting - 28001.642
    n = northing - 38744.572
    x = e / k
    y = n / k
    
    # Calculate auxiliary values
    a1 = a * (1 - f + (5 * f * f / 4) - (35 * f * f * f / 32))
    a2 = a * (3 * f / 2 - 3 * f * f / 4 + 15 * f * f * f / 16)
    a3 = a * (15 * f * f / 8 - 15 * f * f * f / 8)
    a4 = a * (35 * f * f * f / 32)
    n_prime = (x - 300000) / a
    m = a1 * (o_lat * math.pi / 180) - a2 * math.sin(2 * o_lat * math.pi / 180) + a3 * math.sin(4 * o_lat * math.pi / 180) - a4 * math.sin(6 * o_lat * math.pi / 180)
    n_double_prime = y / m
    lat_rad = n_double_prime + ((3 * f / 2) - (27 * f * f * f / 32)) * math.sin(2 * n_double_prime) + ((21 * f * f / 16) - (55 * f * f * f * f / 32)) * math.sin(4 * n_double_prime) + (151 * f * f * f / 96) * math.sin(6 * n_double_prime)
    lat_deg = lat_rad * 180 / math.pi
    
    # Calculate longitude
    y1 = math.tan(n_double_prime)
    y2 = math.pow(y1, 2)
    y3 = math.pow(y1, 3)
    y4 = math.pow(y1, 4)
    y5 = math.pow(y1, 5)
    y6 = math.pow(y1, 6)
    n1 = a1 / math.sqrt(1 - (f * math.sin(lat_rad) * math.sin(lat_rad)))
    t1 = math.tan(lat_rad) * math.tan(lat_rad)
    c1 = f * f / (1 - f) / (1 - f) * math.cos(lat_rad) * math.cos(lat_rad)
    r1 = a * (1 - f) / math.pow(1 - (f * math.sin(lat_rad) * math.sin(lat_rad)), 1.5)
    d = x / n1
    lng_deg = o_lng + (d - (1 + 2 * t1 + c1) * d * d * d / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * f * f + 24 * t1 * t1) * d * d * d * d * d / 120) / math.cos(lat_rad)
    
    return [lat_deg,lng_deg]

views = Blueprint('views', __name__)

# driver views here
@views.route('/', methods=['GET', 'POST'])
@role_required('driver')
def home():
    carparks = CarPark.query.all()
    features = []
    for carpark in carparks:
        coordinates = svy21_to_wgs84(carpark.x_coord, carpark.y_coord)
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': coordinates[::-1]
            },
            'properties': {
                'address': carpark.address
            }
        }
        features.append(feature)
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    json_str = json.dumps(geojson)
    with open('carparks.geojson', 'w') as f:
        f.write(json_str)
    abs_path = os.path.abspath('carparks.geojson')
    print(f"GeoJSON file saved to: {abs_path}")



    return render_template("home.html", user=current_user, MAPBOX_SECRET_KEY=MAPBOX_SECRET_KEY)

@views.route('/coe-registration', methods=['GET', 'POST'])
@role_required('driver')
def coe_registration():
    if request.method == "POST":
        full_name = request.form.get('fullName')
        car_plate = request.form.get('carPlate')
        coe_expiry_html = request.form.get('coeExpiry')
        coe_expiry = datetime.strptime(coe_expiry_html, '%Y-%m-%d').date()
        new_vehicle = Vehicle(full_name=full_name, car_plate=car_plate, coe_expiry=coe_expiry, user_id=current_user.id)
        db.session.add(new_vehicle) 
        db.session.commit()
        return render_template("coe_registered.html", user=current_user)
    return render_template("coe_registration.html", user=current_user)

@views.route('/coe-registration', methods=['GET', 'POST'])
@role_required('driver')
def coe_registered():
    car = Vehicle.query.all()
    return render_template("coe_registered.html", user=current_user)

@views.route('/view-rewards', methods=['GET', 'POST'])
@role_required('driver')
def view_rewards():
    rewards = Reward.query.all()
    return render_template("view_rewards.html", user=current_user, rewards=rewards)

# corporate views here
@views.route('/rewards-creation', methods=['GET', 'POST'])
@role_required('corporate')
def rewards_creation():
    if request.method == "POST":
        reward_title = request.form.get('rewardTitle')
        reward_expiry_html = request.form.get('rewardExpiry')
        reward_details = request.form.get('rewardDetails')
        reward_expiry = datetime.strptime(reward_expiry_html, '%Y-%m-%d').date()
        new_reward = Reward(reward_title=reward_title, reward_expiry=reward_expiry, reward_details=reward_details, user_id= current_user.id)
        db.session.add(new_reward) 
        db.session.commit()
    return render_template("rewards_creation.html", user=current_user)
