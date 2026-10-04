import os
import io
import random
from faker import Faker
from django.core.files import File
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from PIL import Image, ImageDraw
from base_feature_app.models import Blog
from django_attachments.models import Attachment, Library

GRADIENT_PALETTES = [
    ((255, 107, 107), (255, 142, 83)),
    ((108, 99, 255), (168, 130, 255)),
    ((0, 184, 148), (85, 239, 196)),
    ((253, 203, 110), (255, 159, 67)),
    ((9, 132, 227), (116, 185, 255)),
    ((232, 67, 147), (255, 118, 117)),
    ((0, 206, 209), (72, 219, 251)),
    ((255, 71, 87), (255, 107, 129)),
    ((46, 213, 115), (123, 237, 159)),
    ((255, 165, 2), (255, 200, 87)),
]

class Command(BaseCommand):
    help = 'Create Blog records in the database'

    def add_arguments(self, parser):
        parser.add_argument('number_of_blogs', type=int, nargs='?', default=10)

    def handle(self, *args, **options):
        number_of_blogs = options['number_of_blogs']
        fake = Faker()

        # List of test images
        test_images = [
            'media/temp/blog/image_temp1.webp',
            'media/temp/blog/image_temp2.webp',
            'media/temp/blog/image_temp3.webp',
            'media/temp/blog/image_temp4.webp',
        ]

        def _generate_gradient_image(index):
            """Generate a colorful gradient placeholder image."""
            w, h = 800, 600
            c1, c2 = GRADIENT_PALETTES[index % len(GRADIENT_PALETTES)]
            img = Image.new('RGB', (w, h))
            for y in range(h):
                t = y / h
                r = int(c1[0] + (c2[0] - c1[0]) * t)
                g = int(c1[1] + (c2[1] - c1[1]) * t)
                b = int(c1[2] + (c2[2] - c1[2]) * t)
                row = Image.new('RGB', (w, 1), (r, g, b))
                img.paste(row, (0, y))
            draw = ImageDraw.Draw(img, 'RGBA')
            for _ in range(4):
                cx, cy = random.randint(0, w), random.randint(0, h)
                cr = random.randint(80, 200)
                draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(255, 255, 255, 35))
            buffer = io.BytesIO()
            img.convert('RGB').save(buffer, format='WEBP', quality=85)
            buffer.seek(0)
            return ContentFile(buffer.read(), name=f'placeholder_{index}.webp')

        def _get_image_file(index=0):
            existing = [p for p in test_images if os.path.isfile(os.path.join(os.getcwd(), p))]
            if existing:
                selected = random.choice(existing)
                full_image_path = os.path.join(os.getcwd(), selected)
                with open(full_image_path, 'rb') as image_file:
                    return File(image_file, name=os.path.basename(full_image_path))

            return _generate_gradient_image(index)

        categories = [
            'Technology',
            'Health',
            'Travel',
            'Education',
            'Food',
            'Fashion'
        ]

        for i in range(number_of_blogs):
            category = random.choice(categories)
            title = fake.sentence(nb_words=6).rstrip('.')
            description = fake.text(max_nb_chars=1500)

            # Create a new library for the image
            image = Library.objects.create(title=title)

            upload = _get_image_file(index=i)
            Attachment.objects.create(
                library=image,
                file=upload,
                original_name=getattr(upload, 'name', 'placeholder.webp'),
                rank=0,
            )

            new_blog = Blog.objects.create(
                title=title + ' (EN)',
                description=description + ' (EN)',
                category=category + ' (EN)',
                image=image,
            )

            self.stdout.write(self.style.SUCCESS(f'Blog "{new_blog}" created'))

        self.stdout.write(self.style.SUCCESS(f'{number_of_blogs} Blog records created'))
